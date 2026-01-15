import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { TwitterApi } from 'twitter-api-v2';
import open from 'open';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

// --- Configuration ---
const CONFIG_FILE = 'twitter_config.json';
const CONFIG_PATH = join(process.cwd(), CONFIG_FILE);

interface TwitterConfig {
    // OAuth 2.0 User Context
    userAccessToken?: string;
    refreshToken?: string;
    expiresAt?: number;
    // OAuth 1.0a (for backward compatibility)
    appKey?: string;
    appSecret?: string;
    accessToken?: string;
    accessSecret?: string;
}

function getConfig(): TwitterConfig | null {
    if (!existsSync(CONFIG_PATH)) {
        return null;
    }
    try {
        const configData = readFileSync(CONFIG_PATH, 'utf-8');
        return JSON.parse(configData);
    } catch (error) {
        console.error('Error reading config file:', error);
        return null;
    }
}

function saveConfig(config: TwitterConfig): void {
    try {
        writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
        console.error(`Twitter config saved to ${CONFIG_PATH}`);
    } catch (error) {
        console.error('Error saving config file:', error);
        throw new Error('Failed to save Twitter configuration');
    }
}

// --- Helper Functions ---
function getTwitterClient(): TwitterApi {
    // First, try OAuth 2.0 User Context from environment variables
    const envUserAccessToken = process.env.TWITTER_USER_ACCESS_TOKEN;
    if (envUserAccessToken) {
        console.error('Using OAuth 2.0 User Context authentication (environment variable)');
        return new TwitterApi(envUserAccessToken);
    }
    
    // Then try stored OAuth 2.0 User Context token
    const config = getConfig();
    if (config?.userAccessToken) {
        // Check if token is expired
        if (config.expiresAt && Date.now() > config.expiresAt) {
            console.error('OAuth 2.0 User Context token expired, need to re-authenticate');
            throw new Error('OAuth 2.0 User Context token expired. Please run start_oauth2_flow() again.');
        }
        console.error('Using OAuth 2.0 User Context authentication (stored token)');
        return new TwitterApi(config.userAccessToken);
    }
    
    // Fallback to OAuth 1.0a for backward compatibility
    const apiKey = process.env.TWITTER_API_KEY;
    const apiSecret = process.env.TWITTER_API_SECRET;
    const accessToken = process.env.TWITTER_ACCESS_TOKEN;
    const accessSecret = process.env.TWITTER_ACCESS_SECRET || process.env.TWITTER_ACCESS_TOKEN_SECRET;
    
    if (!apiKey || !apiSecret || !accessToken || !accessSecret) {
        throw new Error('Twitter not authenticated. Please use start_oauth2_flow() for OAuth 2.0 User Context or set OAuth 1.0a credentials.');
    }
    
    console.error('Using OAuth 1.0a authentication (fallback)');
    return new TwitterApi({
        appKey: apiKey,
        appSecret: apiSecret,
        accessToken: accessToken,
        accessSecret: accessSecret,
    });
}

function handleTwitterError(error: any): string {
    console.error('Twitter API Error:', JSON.stringify(error, null, 2));
    
    // Return raw error data for debugging
    return `Raw Twitter API Error:

\`\`\`json
${JSON.stringify(error, null, 2)}
\`\`\`

Please analyze this error to understand what went wrong.`;
}

// --- OAuth 2.0 PKCE Functions ---
async function startOAuth2Flow() {
    try {
        const clientId = process.env.TWITTER_CLIENT_ID;
        if (!clientId) {
            throw new Error('TWITTER_CLIENT_ID environment variable is required for OAuth 2.0 flow');
        }

        const client = new TwitterApi({ clientId });
        
        // Generate OAuth 2.0 auth link with PKCE
        const authLink = client.generateOAuth2AuthLink('http://localhost:3000/callback', {
            scope: ['tweet.read', 'tweet.write', 'users.read', 'follows.read', 'follows.write', 'offline.access'],
        });
        
        console.error(`Please visit this URL to authorize the app: ${authLink.url}`);
        console.error('After authorization, you will be redirected to a callback URL with a code.');
        
        // Open the auth URL in the browser
        try {
            await open(authLink.url);
            console.error('Opened authorization URL in your browser.');
        } catch (error) {
            console.error('Could not open browser automatically. Please visit the URL manually.');
        }

        return {
            type: 'text',
            text: `🔐 Twitter OAuth 2.0 Authentication Started

Please follow these steps:
1. Visit: ${authLink.url}
2. Authorize the application
3. You'll be redirected to a callback URL with a code
4. Copy the code from the URL and use complete_oauth2_flow(code)

Note: The authorization URL has been opened in your browser if possible.

State: ${authLink.state}
Code Verifier: ${authLink.codeVerifier}

Save the Code Verifier for the next step!`,
        };
    } catch (error: any) {
        console.error('Error during OAuth 2.0 flow:', error);
        return {
            type: 'text',
            text: `❌ OAuth 2.0 Flow Error: ${handleTwitterError(error)}`,
        };
    }
}

async function completeOAuth2Flow(code: string, codeVerifier: string) {
    try {
        const clientId = process.env.TWITTER_CLIENT_ID;
        if (!clientId) {
            throw new Error('TWITTER_CLIENT_ID environment variable is required');
        }

        const client = new TwitterApi({ clientId });

        // Complete the OAuth 2.0 flow with the code
        const { client: loggedClient, accessToken, refreshToken } = await client.loginWithOAuth2({
            code,
            redirectUri: 'http://localhost:3000/callback',
            codeVerifier,
        });
        
        // Verify the authentication by getting user info
        const user = await loggedClient.v2.me();
        
        // Save the tokens to config file for future use
        const config: TwitterConfig = {
            userAccessToken: accessToken,
            refreshToken: refreshToken,
            expiresAt: Date.now() + (2 * 60 * 60 * 1000), // 2 hours from now (typical OAuth 2.0 token lifetime)
        };
        saveConfig(config);
        
        return {
            type: 'text',
            text: `✅ Twitter OAuth 2.0 Authentication Successful!

Authenticated as: @${user.data.username} (${user.data.name})
User ID: ${user.data.id}

Access Token: ${accessToken.substring(0, 20)}...
${refreshToken ? `Refresh Token: ${refreshToken.substring(0, 20)}...` : ''}

✅ Token saved automatically! You can now use all Twitter tools without setting environment variables.

The token will be automatically used for all subsequent tool calls.`,
        };
    } catch (error: any) {
        console.error('Error completing OAuth 2.0 flow:', error);
        return {
            type: 'text',
            text: `❌ OAuth 2.0 Completion Error: ${handleTwitterError(error)}`,
        };
    }
}

// --- Core Functions ---
async function checkAuthStatus() {
    try {
        // Check for OAuth 2.0 User Context access token first (recommended for X API V2 Products)
        const envUserAccessToken = process.env.TWITTER_USER_ACCESS_TOKEN;
        if (envUserAccessToken) {
            const client = new TwitterApi(envUserAccessToken);
            console.error('Testing Twitter API connection with OAuth 2.0 User Context (environment variable)...');
            const user = await client.v2.me();
            console.error('Twitter API connection successful');
            
            return {
                type: 'text',
                text: `✅ Twitter Authenticated Successfully! (OAuth 2.0 User Context - Environment Variable)

Authenticated as: @${user.data.username} (${user.data.name})
User ID: ${user.data.id}

All Twitter tools are available.`,
            };
        }
        
        // Check for stored OAuth 2.0 User Context token
        const config = getConfig();
        if (config?.userAccessToken) {
            // Check if token is expired
            if (config.expiresAt && Date.now() > config.expiresAt) {
                return {
                    type: 'text',
                    text: `❌ Twitter Token Expired

Your OAuth 2.0 User Context token has expired.

Please run start_oauth2_flow() to re-authenticate.`,
                };
            }
            
            const client = new TwitterApi(config.userAccessToken);
            console.error('Testing Twitter API connection with OAuth 2.0 User Context (stored token)...');
            const user = await client.v2.me();
            console.error('Twitter API connection successful');
            
            return {
                type: 'text',
                text: `✅ Twitter Authenticated Successfully! (OAuth 2.0 User Context - Stored Token)

Authenticated as: @${user.data.username} (${user.data.name})
User ID: ${user.data.id}

All Twitter tools are available.`,
            };
        }
        
        // Check if we have all required OAuth 1.0a credentials
        const apiKey = process.env.TWITTER_API_KEY;
        const apiSecret = process.env.TWITTER_API_SECRET;
        const accessToken = process.env.TWITTER_ACCESS_TOKEN;
        const accessSecret = process.env.TWITTER_ACCESS_SECRET || process.env.TWITTER_ACCESS_TOKEN_SECRET;
        
        if (!apiKey || !apiSecret || !accessToken || !accessSecret) {
            return {
                type: 'text',
                text: `❌ Twitter Not Authenticated

For X API V2 Products, you need OAuth 2.0 User Context authentication:

**Option 1: OAuth 2.0 PKCE Flow (Recommended)**
1. Set TWITTER_CLIENT_ID environment variable
2. Use start_oauth2_flow() to begin authentication
3. Complete with complete_oauth2_flow(code, codeVerifier)

**Option 2: Direct OAuth 2.0 User Context Token**
Set environment variable:
• TWITTER_USER_ACCESS_TOKEN

**Option 3: OAuth 1.0a Credentials (Fallback)**
Set environment variables:
${!apiKey ? '• TWITTER_API_KEY (Consumer Key)' : ''}
${!apiSecret ? '• TWITTER_API_SECRET (Consumer Secret)' : ''}
${!accessToken ? '• TWITTER_ACCESS_TOKEN' : ''}
${!accessSecret ? '• TWITTER_ACCESS_SECRET' : ''}

Note: App-only Bearer Tokens don't work for user-specific endpoints.`,
            };
        }
        
        // Test the authentication by getting user info
        const client = getTwitterClient();
        console.error('Testing Twitter API connection...');
        const user = await client.v2.me();
        console.error('Twitter API connection successful');
        
        return {
            type: 'text',
            text: `✅ Twitter Authenticated Successfully!

Authenticated as: @${user.data.username} (${user.data.name})
User ID: ${user.data.id}

All Twitter tools are available.`,
        };
    } catch (error: any) {
        return {
            type: 'text',
            text: `❌ Twitter Authentication Error: ${handleTwitterError(error)}`,
        };
    }
}

async function postTweet(input: z.infer<typeof TweetSchema>) {
    const { text, reply_to_tweet_id, media_paths } = input;
    const client = getTwitterClient();
    
    try {
        let mediaIds: string[] = [];
        
        // Handle media uploads if provided
        if (media_paths && media_paths.length > 0) {
            for (const mediaPath of media_paths) {
                // Check if file exists
                if (!existsSync(mediaPath.file_path)) {
                    throw new Error(`File not found: ${mediaPath.file_path}`);
                }
                
                // Read file as buffer
                const mediaBuffer = readFileSync(mediaPath.file_path);
                
                // Upload media using v1.1 API (supports OAuth 1.0a)
                const mediaId = await client.v1.uploadMedia(mediaBuffer, { 
                    mimeType: mediaPath.media_type || 'image/jpeg' 
                });
                
                mediaIds.push(mediaId);
            }
        }
        
        // Prepare tweet options
        const tweetOptions: any = { text };
        
        if (mediaIds.length > 0) {
            tweetOptions.media = { media_ids: mediaIds };
        }
        
        if (reply_to_tweet_id) {
            tweetOptions.reply = { in_reply_to_tweet_id: reply_to_tweet_id };
        }
        
        const tweet = await client.v2.tweet(tweetOptions);
        
        const mediaInfo = mediaIds.length > 0 ? `\n\nMedia attached: ${mediaIds.length} file(s)` : '';
        
        return {
            type: 'text',
            text: `✅ Tweet posted successfully!${mediaInfo} - Raw Data:

\`\`\`json
${JSON.stringify(tweet, null, 2)}
\`\`\`

Please parse this data and format the tweet information in a readable way.`,
        };
    } catch (error: any) {
        return {
            type: 'text',
            text: `❌ Post Tweet Error: ${handleTwitterError(error)}`,
        };
    }
}

async function getMyTweets(input: z.infer<typeof GetMyTweetsSchema>) {
    const { max_results = 10 } = input;
    const client = getTwitterClient();
    
    try {
        // For free apps, use a more efficient approach
        // Try to get user's own timeline without the extra me() call
        const tweets = await client.v2.userTimeline('me', {
            max_results: Math.min(max_results, 10), // Reduced for free apps
            'tweet.fields': ['created_at', 'public_metrics'],
        });
        
        // Return raw data for LLM to parse
        return {
            type: 'text',
            text: `📱 Your Recent Tweets - Raw Data:

\`\`\`json
${JSON.stringify(tweets, null, 2)}
\`\`\`

Please parse this data and format the tweets in a readable way.`,
        };
    } catch (error: any) {
        // If 'me' doesn't work, fall back to the two-call approach
        try {
            const me = await client.v2.me();
            const tweets = await client.v2.userTimeline(me.data.id, {
                max_results: Math.min(max_results, 10), // Reduced for free apps
                'tweet.fields': ['created_at', 'public_metrics'],
            });
            
            return {
                type: 'text',
                text: `📱 Your Recent Tweets - Raw Data:

\`\`\`json
${JSON.stringify(tweets, null, 2)}
\`\`\`

Please parse this data and format the tweets in a readable way.`,
            };
        } catch (fallbackError: any) {
            return {
                type: 'text',
                text: `❌ Get My Tweets Error: ${handleTwitterError(fallbackError)}`,
            };
        }
    }
}

async function checkRateLimits() {
    const client = getTwitterClient();
    
    try {
        // Try to get rate limit status using v1.1 endpoint
        const rateLimits = await client.v1.rateLimitStatuses();
        
        return {
            type: 'text',
            text: `📊 Twitter API Rate Limits - Raw Data:

\`\`\`json
${JSON.stringify(rateLimits, null, 2)}
\`\`\`

Please parse this data to see your current rate limit status.`,
        };
    } catch (error: any) {
        return {
            type: 'text',
            text: `❌ Check Rate Limits Error: ${handleTwitterError(error)}`,
        };
    }
}

async function searchTweets(input: z.infer<typeof SearchTweetsSchema>) {
    const { query, max_results = 10 } = input;
    const client = getTwitterClient();
    
    try {
        const tweets = await client.v2.search(query, {
            max_results: Math.min(max_results, 10), // Reduced for free apps
            'tweet.fields': ['created_at', 'author_id', 'public_metrics'],
            'user.fields': ['username', 'name'],
        });
        
        // Return raw data for LLM to parse
        return {
            type: 'text',
            text: `🔍 Search Results for "${query}" - Raw Data:

\`\`\`json
${JSON.stringify(tweets, null, 2)}
\`\`\`

Please parse this data and format the tweets in a readable way.`,
        };
    } catch (error: any) {
        return {
            type: 'text',
            text: `❌ Search Tweets Error: ${handleTwitterError(error)}`,
        };
    }
}

// --- Tool Schemas ---
const CompleteOAuth2Schema = z.object({
    code: z.string().describe('Authorization code from the callback URL'),
    code_verifier: z.string().describe('Code verifier from the OAuth 2.0 flow'),
});

const MediaPathSchema = z.object({
    file_path: z.string().describe('Path to the image file to upload'),
    media_type: z.string().optional().describe('MIME type of the media (e.g., image/jpeg, image/png, image/gif)'),
});

const TweetSchema = z.object({
    text: z.string().min(1).max(280).describe('Tweet text content (max 280 characters)'),
    reply_to_tweet_id: z.string().optional().describe('ID of tweet to reply to'),
    media_paths: z.array(MediaPathSchema).max(4).optional().describe('Array of media files to attach (max 4 images)'),
});

const GetMyTweetsSchema = z.object({
    max_results: z.number().min(1).max(100).optional().describe('Maximum number of tweets to retrieve (default: 10, max: 100)'),
});

const SearchTweetsSchema = z.object({
    query: z.string().min(1).describe('Search query for tweets'),
    max_results: z.number().min(1).max(100).optional().describe('Maximum number of tweets to retrieve (default: 10, max: 100)'),
});

// --- MCP Server Setup ---
const server = new Server(
    {
        name: 'twitter-server',
        version: '1.0.0',
    },
    {
        capabilities: {
            tools: {},
        },
    }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: 'check_auth_status',
                description: 'Check if Twitter is authenticated. Use this first to verify your credentials are working.',
                inputSchema: {
                    type: 'object',
                    properties: {},
                },
            },
            {
                name: 'start_oauth2_flow',
                description: 'Start OAuth 2.0 PKCE authentication flow for X API V2 Products. Requires TWITTER_CLIENT_ID.',
                inputSchema: {
                    type: 'object',
                    properties: {},
                },
            },
            {
                name: 'complete_oauth2_flow',
                description: 'Complete OAuth 2.0 PKCE authentication with authorization code and code verifier.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        code: {
                            type: 'string',
                            description: 'Authorization code from the callback URL',
                        },
                        code_verifier: {
                            type: 'string',
                            description: 'Code verifier from the OAuth 2.0 flow',
                        },
                    },
                    required: ['code', 'code_verifier'],
                },
            },
            {
                name: 'check_rate_limits',
                description: 'Check current Twitter API rate limit status to debug rate limiting issues.',
                inputSchema: {
                    type: 'object',
                    properties: {},
                },
            },
            {
                name: 'post_tweet',
                description: 'Post a new tweet with optional media attachments. Automatically handles media upload if media_paths are provided.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        text: {
                            type: 'string',
                            description: 'Tweet text content (max 280 characters)',
                        },
                        reply_to_tweet_id: {
                            type: 'string',
                            description: 'ID of tweet to reply to',
                        },
                        media_paths: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    file_path: {
                                        type: 'string',
                                        description: 'Path to the image file to upload',
                                    },
                                    media_type: {
                                        type: 'string',
                                        description: 'MIME type of the media (e.g., image/jpeg, image/png, image/gif)',
                                    },
                                },
                                required: ['file_path'],
                            },
                            maxItems: 4,
                            description: 'Array of media files to attach (max 4 images)',
                        },
                    },
                    required: ['text'],
                },
            },
            {
                name: 'get_my_tweets',
                description: 'Get your recent tweets. Requires authentication.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        max_results: {
                            type: 'number',
                            description: 'Maximum number of tweets to retrieve (default: 10, max: 100)',
                        },
                    },
                },
            },
            {
                name: 'search_tweets',
                description: 'Search for tweets using a query. Requires authentication.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        query: {
                            type: 'string',
                            description: 'Search query for tweets',
                        },
                        max_results: {
                            type: 'number',
                            description: 'Maximum number of tweets to retrieve (default: 10, max: 100)',
                        },
                    },
                    required: ['query'],
                },
            },
        ],
    };
});

server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
    const { name, arguments: args } = request.params;

    try {
        switch (name) {
            case 'check_auth_status': {
                const result = await checkAuthStatus();
                return { content: [result] };
            }
            case 'start_oauth2_flow': {
                const result = await startOAuth2Flow();
                return { content: [result] };
            }
            case 'complete_oauth2_flow': {
                const input = CompleteOAuth2Schema.parse(args);
                const result = await completeOAuth2Flow(input.code, input.code_verifier);
                return { content: [result] };
            }
            case 'check_rate_limits': {
                const result = await checkRateLimits();
                return { content: [result] };
            }
            case 'post_tweet': {
                const input = TweetSchema.parse(args);
                const result = await postTweet(input);
                return { content: [result] };
            }
            case 'get_my_tweets': {
                const input = GetMyTweetsSchema.parse(args);
                const result = await getMyTweets(input);
                return { content: [result] };
            }
            case 'search_tweets': {
                const input = SearchTweetsSchema.parse(args);
                const result = await searchTweets(input);
                return { content: [result] };
            }
            default:
                throw new Error(`Unknown tool: ${name}`);
        }
    } catch (error: any) {
        return {
            content: [
                {
                    type: 'text',
                    text: `❌ Error: ${error.message}`,
                },
            ],
        };
    }
});

// Start the server
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('Twitter MCP server running on stdio');
}

main().catch(console.error);