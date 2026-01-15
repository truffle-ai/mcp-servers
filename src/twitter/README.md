# Twitter MCP Server

A Model Context Protocol (MCP) server that provides Twitter/X integration for AI agents. This server enables AI agents to interact with Twitter through a clean, simple interface.

## Features

- **Simple Authentication**: Uses OAuth 1.0a with environment variables only
- **Tweet Management**: Post tweets and get your recent tweets
- **Media Support**: Upload images and post tweets with media attachments
- **Search**: Search for tweets by keywords and hashtags
- **Clean Interface**: Minimal, focused tool set for easy LLM usage

## Setup

### 1. Twitter Developer Account

1. Go to [Twitter Developer Portal](https://developer.twitter.com/)
2. Create a new app or use an existing one
3. Enable OAuth 1.0a authentication
4. Generate your credentials:
   - **Consumer Key** (API Key)
   - **Consumer Secret** (API Secret)
   - **Access Token**
   - **Access Token Secret**

### 2. Environment Variables

Set these environment variables with your Twitter credentials:

```bash
export TWITTER_API_KEY="your_consumer_key"
export TWITTER_API_SECRET="your_consumer_secret"
export TWITTER_ACCESS_TOKEN="your_access_token"
export TWITTER_ACCESS_SECRET="your_access_token_secret"
```

### 3. Installation

```bash
cd /Users/shaun/Desktop/Projects/mcp-servers/src/twitter
npm install
npm run build
```

## Usage

### Available Tools

1. **`check_auth_status()`** - Check if Twitter is authenticated
2. **`post_tweet(text, reply_to_tweet_id?, media_paths?)`** - Post a new tweet with optional media attachments
3. **`get_my_tweets(max_results?)`** - Get your recent tweets
4. **`search_tweets(query, max_results?)`** - Search for tweets

### Example Usage

```typescript
// Check authentication
await check_auth_status();

// Post a simple text tweet
await post_tweet({ text: "Hello from my AI agent!" });

// Post a tweet with a single image
await post_tweet({ 
    text: "Check out this image!", 
    media_paths: [{ 
        file_path: "/path/to/image.jpg", 
        media_type: "image/jpeg" 
    }]
});

// Post a tweet with multiple images
await post_tweet({ 
    text: "Here are multiple images!", 
    media_paths: [
        { file_path: "/path/to/image1.jpg", media_type: "image/jpeg" },
        { file_path: "/path/to/image2.png", media_type: "image/png" }
    ]
});

// Reply to a tweet with media
await post_tweet({ 
    text: "Replying with an image!", 
    reply_to_tweet_id: "1234567890",
    media_paths: [{ file_path: "/path/to/image.jpg" }]
});

// Get recent tweets
await get_my_tweets({ max_results: 5 });

// Search for tweets
await search_tweets({ query: "AI agents", max_results: 10 });
```

## Authentication Flow

This server uses **OAuth 1.0a with environment variables only**. No interactive authentication flow is needed:

1. Set your Twitter credentials as environment variables
2. The server automatically authenticates using these credentials
3. Use `check_auth_status()` to verify authentication is working

## Error Handling

The server provides clear error messages for common issues:
- Missing environment variables
- Invalid credentials
- Rate limiting
- API errors

## Development

```bash
# Install dependencies
npm install

# Build the server
npm run build

# Run the server
node dist/index.js
```

## Integration with Dexto

This server is designed to work with the Dexto agent framework. The agent configuration automatically passes the required environment variables to the MCP server.

## License

MIT License