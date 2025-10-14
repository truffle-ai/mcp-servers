#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
    CallToolResultSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { join, dirname, basename, extname } from 'path';
import { createHash } from 'crypto';

// --- Configuration ---
const SUPPORTED_VIDEO_SIZES = [
    '720x1280',   // 9:16 (vertical)
    '1280x720',   // 16:9 (horizontal)
    '1024x1024',  // 1:1 (square)
    '1024x1808',  // 9:16 (vertical HD)
    '1808x1024',  // 16:9 (horizontal HD)
] as const;

const SUPPORTED_DURATIONS = ['4', '8', '16', '32'] as const;

const SUPPORTED_MODELS = ['sora-2'] as const;

// --- Helper Functions ---
function getApiKey(): string {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        throw new Error('OPENAI_API_KEY environment variable is required');
    }
    return apiKey;
}

function ensureDirectory(outputDirectory?: string): string {
    if (outputDirectory) {
        if (!existsSync(outputDirectory)) {
            mkdirSync(outputDirectory, { recursive: true });
        }
        return outputDirectory;
    }
    return process.cwd();
}

function generateFilename(prefix: string, prompt: string, extension: string = '.mp4'): string {
    const promptHash = createHash('md5').update(prompt).digest('hex').substring(0, 8);
    const timestamp = Date.now();
    return `${prefix}_${promptHash}_${timestamp}${extension}`;
}

function validateImageFile(filePath: string): boolean {
    const supportedExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
    const ext = extname(filePath).toLowerCase();
    return supportedExtensions.includes(ext) && existsSync(filePath);
}

function validateVideoFile(filePath: string): boolean {
    const supportedExtensions = ['.mp4', '.mov', '.avi', '.webm'];
    const ext = extname(filePath).toLowerCase();
    return supportedExtensions.includes(ext) && existsSync(filePath);
}

// --- Tool Schemas ---
const CreateVideoSchema = z.object({
    prompt: z.string().min(1).describe('Text description of the video to generate'),
    model: z.enum(SUPPORTED_MODELS).optional().default('sora-2').describe('Model to use for generation'),
    seconds: z.enum(SUPPORTED_DURATIONS).optional().default('4').describe('Video duration in seconds'),
    size: z.enum(SUPPORTED_VIDEO_SIZES).optional().default('720x1280').describe('Video resolution as widthxheight'),
    input_reference: z.string().optional().describe('Path to reference image or video file'),
    output_directory: z.string().optional().describe('Directory to save the video (defaults to current directory)'),
});

const GetVideoStatusSchema = z.object({
    video_id: z.string().min(1).describe('ID of the video to check status for'),
});

const ListVideosSchema = z.object({
    limit: z.number().min(1).max(100).optional().default(20).describe('Number of videos to retrieve'),
    after: z.string().optional().describe('Pagination cursor - get videos after this ID'),
    order: z.enum(['asc', 'desc']).optional().default('desc').describe('Sort order'),
});

const DownloadVideoSchema = z.object({
    video_id: z.string().min(1).describe('ID of the video to download'),
    output_path: z.string().optional().describe('Directory to save the video (defaults to ~/Downloads)'),
    filename: z.string().optional().describe('Custom filename (defaults to video_id.mp4)'),
});

const RemixVideoSchema = z.object({
    video_id: z.string().min(1).describe('ID of the completed video to remix'),
    prompt: z.string().min(1).describe('New text prompt for the remix'),
    output_directory: z.string().optional().describe('Directory to save the remix (defaults to current directory)'),
});

const DeleteVideoSchema = z.object({
    video_id: z.string().min(1).describe('ID of the video to delete'),
});

// --- Core Functions ---
async function createVideo(input: z.infer<typeof CreateVideoSchema>) {
    const { prompt, model, seconds, size, input_reference, output_directory } = input;
    const apiKey = getApiKey();
    
    try {
        console.error(`Creating video: "${prompt}" with model: ${model}, duration: ${seconds}s, size: ${size}`);

        const requestBody: any = {
            model,
            prompt,
            seconds: seconds,
            size,
        };

        // Add input reference if provided
        if (input_reference) {
            if (validateImageFile(input_reference)) {
                const imageData = readFileSync(input_reference);
                const base64Image = imageData.toString('base64');
                const mimeType = extname(input_reference).toLowerCase() === '.png' ? 'image/png' : 'image/jpeg';
                requestBody.input_reference = {
                    type: 'image',
                    data: base64Image,
                    mime_type: mimeType,
                };
            } else if (validateVideoFile(input_reference)) {
                const videoData = readFileSync(input_reference);
                const base64Video = videoData.toString('base64');
                const mimeType = extname(input_reference).toLowerCase() === '.mp4' ? 'video/mp4' : 'video/quicktime';
                requestBody.input_reference = {
                    type: 'video',
                    data: base64Video,
                    mime_type: mimeType,
                };
            } else {
                throw new Error(`Invalid input reference file: ${input_reference}. Supported formats: JPG, PNG, WebP, MP4, MOV, AVI, WebM`);
            }
        }

        const response = await fetch('https://api.openai.com/v1/videos', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`API request failed: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
        }

        const data = await response.json();
        
        const outputPath = ensureDirectory(output_directory);
        const filename = generateFilename('sora_video', prompt);
        const metadataPath = join(outputPath, filename.replace('.mp4', '_metadata.json'));
        
        // Save metadata
        writeFileSync(metadataPath, JSON.stringify(data, null, 2));

        return [
            {
                type: 'text',
                text: `🎬 Video generation started successfully!\n\n📋 **Video Details:**\n- **ID:** ${data.id}\n- **Model:** ${data.model}\n- **Duration:** ${data.seconds}s\n- **Size:** ${data.size}\n- **Status:** ${data.status}\n- **Created:** ${new Date(data.created_at * 1000).toLocaleString()}\n\n📁 **Metadata saved:** ${metadataPath}\n\n⏳ **Next Steps:**\n1. Use \`get_video_status\` to check progress\n2. Use \`download_video\` to save when complete\n\n💡 **Tip:** Video generation typically takes 1-3 minutes.`,
            },
        ];
    } catch (error: any) {
        console.error('Error creating video:', error);
        throw new Error(`Failed to create video: ${error.message}`);
    }
}

async function getVideoStatus(input: z.infer<typeof GetVideoStatusSchema>) {
    const { video_id } = input;
    const apiKey = getApiKey();
    
    try {
        console.error(`Checking status for video: ${video_id}`);

        const response = await fetch(`https://api.openai.com/v1/videos/${video_id}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
            },
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`API request failed: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
        }

        const data = await response.json();
        
        // Debug: Log the full response to understand the structure
        console.error('Full video status response:', JSON.stringify(data, null, 2));
        
        const progressBar = '█'.repeat(Math.floor(data.progress / 5)) + '░'.repeat(20 - Math.floor(data.progress / 5));
        const statusEmoji = data.status === 'completed' ? '✅' : data.status === 'processing' ? '⏳' : '⏸️';
        
        let statusText = `${statusEmoji} **Video Status:** ${data.status.toUpperCase()}\n\n📊 **Progress:** ${data.progress}% [${progressBar}]\n\n📋 **Details:**\n- **ID:** ${data.id}\n- **Model:** ${data.model}\n- **Duration:** ${data.seconds}s\n- **Size:** ${data.size}\n- **Created:** ${new Date(data.created_at * 1000).toLocaleString()}`;

        if (data.status === 'completed') {
            statusText += `\n- **Completed:** ${new Date(data.completed_at * 1000).toLocaleString()}`;
            
            // Show expiration info
            if (data.expires_at) {
                const now = Math.floor(Date.now() / 1000);
                const expiresAt = data.expires_at;
                const isExpired = now > expiresAt;
                
                if (isExpired) {
                    statusText += `\n- **Expired:** ${new Date(expiresAt * 1000).toLocaleString()} ⏰`;
                } else {
                    statusText += `\n- **Expires:** ${new Date(expiresAt * 1000).toLocaleString()}`;
                }
            }
            
            statusText += `\n\n🎉 **Video is ready!** Use \`download_video\` to save it to your computer.`;
        } else if (data.status === 'failed') {
            statusText += `\n\n❌ **Generation failed.** Check the error details and try again.`;
        } else {
            statusText += `\n\n⏳ **Still processing...** Check back in a moment.`;
        }

        return [
            {
                type: 'text',
                text: statusText,
            },
        ];
    } catch (error: any) {
        console.error('Error getting video status:', error);
        throw new Error(`Failed to get video status: ${error.message}`);
    }
}

async function listVideos(input: z.infer<typeof ListVideosSchema>) {
    const { limit, after, order } = input;
    const apiKey = getApiKey();
    
    try {
        console.error(`Listing videos: limit=${limit}, after=${after}, order=${order}`);

        const params = new URLSearchParams({
            limit: limit.toString(),
            order,
        });
        
        if (after) {
            params.append('after', after);
        }

        const response = await fetch(`https://api.openai.com/v1/videos?${params}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
            },
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`API request failed: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
        }

        const data = await response.json();
        
        if (!data.data || data.data.length === 0) {
            return [
                {
                    type: 'text',
                    text: '📭 No videos found. Create your first video with `create_video`!',
                },
            ];
        }

        const videosList = data.data.map((video: any) => {
            const statusEmoji = video.status === 'completed' ? '✅' : video.status === 'processing' ? '⏳' : '⏸️';
            return `**${statusEmoji} ${video.id}**\n- Status: ${video.status} (${video.progress}%)\n- Model: ${video.model}\n- Duration: ${video.seconds}s\n- Size: ${video.size}\n- Created: ${new Date(video.created_at * 1000).toLocaleString()}`;
        }).join('\n\n');

        let resultText = `📹 **Your Videos (${data.data.length} of ${data.has_more ? 'many' : data.data.length}):**\n\n${videosList}`;
        
        if (data.has_more) {
            resultText += `\n\n📄 **Pagination:** Use \`list_videos\` with \`after: "${data.data[data.data.length - 1].id}"\` to see more.`;
        }

        return [
            {
                type: 'text',
                text: resultText,
            },
        ];
    } catch (error: any) {
        console.error('Error listing videos:', error);
        throw new Error(`Failed to list videos: ${error.message}`);
    }
}

async function downloadVideo(input: z.infer<typeof DownloadVideoSchema>) {
    const { video_id, output_path, filename } = input;
    const apiKey = getApiKey();
    
    try {
        console.error(`Downloading video: ${video_id}`);

        // First check if video is ready
        const statusResponse = await fetch(`https://api.openai.com/v1/videos/${video_id}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
            },
        });

        if (!statusResponse.ok) {
            const errorData = await statusResponse.json().catch(() => ({}));
            throw new Error(`Failed to check video status: ${statusResponse.status} ${statusResponse.statusText}`);
        }

        const statusData = await statusResponse.json();
        
        if (statusData.status !== 'completed') {
            return [
                {
                    type: 'text',
                    text: `⏳ **Video not ready yet!**\n\nCurrent status: ${statusData.status} (${statusData.progress}%)\n\nPlease wait for completion and try again.`,
                },
            ];
        }

        // Download the video directly from the /content endpoint
        const videoResponse = await fetch(`https://api.openai.com/v1/videos/${video_id}/content`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
            },
        });
        
        if (!videoResponse.ok) {
            throw new Error(`Failed to download video: ${videoResponse.status} ${videoResponse.statusText}`);
        }

        const videoBuffer = await videoResponse.arrayBuffer();
        
        // Determine output path and filename
        const finalOutputPath = output_path || join(process.env.HOME || process.cwd(), 'Downloads');
        const finalFilename = filename || `${video_id}.mp4`;
        const filePath = join(finalOutputPath, finalFilename);
        
        // Ensure directory exists
        ensureDirectory(finalOutputPath);
        
        // Save the video
        writeFileSync(filePath, Buffer.from(videoBuffer));

        // Convert video buffer to base64 for blob storage
        const base64Video = Buffer.from(videoBuffer).toString('base64');
        
        return [
            {
                type: 'text',
                text: `🎉 **Video downloaded successfully!**\n\n📁 **Location:** ${filePath}\n📊 **Size:** ${(videoBuffer.byteLength / 1024 / 1024).toFixed(2)} MB\n🎬 **Video ID:** ${video_id}\n\n✅ Ready to watch!`,
            },
            {
                type: 'resource',
                resource: {
                    uri: `blob:video-${video_id}`,
                    mimeType: 'video/mp4',
                    text: base64Video, // MCP spec uses 'text' field for embedded data
                    title: `Downloaded video: ${finalFilename}`,
                },
            },
        ];
    } catch (error: any) {
        console.error('Error downloading video:', error);
        throw new Error(`Failed to download video: ${error.message}`);
    }
}


async function remixVideo(input: z.infer<typeof RemixVideoSchema>) {
    const { video_id, prompt, output_directory } = input;
    const apiKey = getApiKey();
    
    try {
        console.error(`Creating remix of video: ${video_id} with prompt: "${prompt}"`);

        const response = await fetch('https://api.openai.com/v1/videos', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'sora-2',
                prompt,
                remixed_from_video_id: video_id,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`API request failed: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
        }

        const data = await response.json();
        
        const outputPath = ensureDirectory(output_directory);
        const filename = generateFilename('sora_remix', prompt);
        const metadataPath = join(outputPath, filename.replace('.mp4', '_metadata.json'));
        
        // Save metadata
        writeFileSync(metadataPath, JSON.stringify(data, null, 2));

        return [
            {
                type: 'text',
                text: `🎭 **Video remix started successfully!**\n\n📋 **Remix Details:**\n- **New ID:** ${data.id}\n- **Original ID:** ${video_id}\n- **Model:** ${data.model}\n- **Status:** ${data.status}\n- **Created:** ${new Date(data.created_at * 1000).toLocaleString()}\n\n📁 **Metadata saved:** ${metadataPath}\n\n⏳ **Next Steps:**\n1. Use \`get_video_status\` to check progress\n2. Use \`save_video\` to download when complete`,
            },
        ];
    } catch (error: any) {
        console.error('Error creating remix:', error);
        throw new Error(`Failed to create remix: ${error.message}`);
    }
}

async function deleteVideo(input: z.infer<typeof DeleteVideoSchema>) {
    const { video_id } = input;
    const apiKey = getApiKey();
    
    try {
        console.error(`Deleting video: ${video_id}`);

        const response = await fetch(`https://api.openai.com/v1/videos/${video_id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
            },
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`API request failed: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
        }

        return [
            {
                type: 'text',
                text: `🗑️ **Video deleted successfully!**\n\nVideo ID: ${video_id}\n\n✅ The video and all its assets have been removed from OpenAI's servers.`,
            },
        ];
    } catch (error: any) {
        console.error('Error deleting video:', error);
        throw new Error(`Failed to delete video: ${error.message}`);
    }
}

// --- Server Setup ---
const server = new Server(
    { name: 'sora-video-server', version: '1.0.0' },
    { capabilities: { tools: {} } }
);

// --- Request Handlers ---
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: 'create_video',
                description: 'Generate a video from a text prompt using OpenAI Sora. Supports custom duration, resolution, and reference images/videos.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        prompt: {
                            type: 'string',
                            description: 'Text description of the video to generate',
                        },
                        model: {
                            type: 'string',
                            enum: SUPPORTED_MODELS,
                            description: 'Model to use for generation (default: sora-2)',
                        },
                        seconds: {
                            type: 'string',
                            enum: SUPPORTED_DURATIONS,
                            description: 'Video duration in seconds (default: 4)',
                        },
                        size: {
                            type: 'string',
                            enum: SUPPORTED_VIDEO_SIZES,
                            description: 'Video resolution as widthxheight (default: 720x1280)',
                        },
                        input_reference: {
                            type: 'string',
                            description: 'Path to reference image or video file (optional)',
                        },
                        output_directory: {
                            type: 'string',
                            description: 'Directory to save metadata (defaults to current directory)',
                        },
                    },
                    required: ['prompt'],
                },
            },
            {
                name: 'get_video_status',
                description: 'Check the status and progress of a video generation job.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        video_id: {
                            type: 'string',
                            description: 'ID of the video to check status for',
                        },
                    },
                    required: ['video_id'],
                },
            },
            {
                name: 'list_videos',
                description: 'List all your video generation jobs with pagination.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        limit: {
                            type: 'number',
                            minimum: 1,
                            maximum: 100,
                            description: 'Number of videos to retrieve (default: 20)',
                        },
                        after: {
                            type: 'string',
                            description: 'Pagination cursor - get videos after this ID',
                        },
                        order: {
                            type: 'string',
                            enum: ['asc', 'desc'],
                            description: 'Sort order (default: desc)',
                        },
                    },
                },
            },
            {
                name: 'download_video',
                description: 'Download a completed video to your computer. Automatically saves the video file.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        video_id: {
                            type: 'string',
                            description: 'ID of the video to download',
                        },
                        output_path: {
                            type: 'string',
                            description: 'Directory to save the video (defaults to ~/Downloads)',
                        },
                        filename: {
                            type: 'string',
                            description: 'Custom filename (defaults to video_id.mp4)',
                        },
                    },
                    required: ['video_id'],
                },
            },
            {
                name: 'remix_video',
                description: 'Create a remix of an existing video with a new prompt.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        video_id: {
                            type: 'string',
                            description: 'ID of the completed video to remix',
                        },
                        prompt: {
                            type: 'string',
                            description: 'New text prompt for the remix',
                        },
                        output_directory: {
                            type: 'string',
                            description: 'Directory to save metadata (defaults to current directory)',
                        },
                    },
                    required: ['video_id', 'prompt'],
                },
            },
            {
                name: 'delete_video',
                description: 'Delete a video job and its assets from OpenAI servers.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        video_id: {
                            type: 'string',
                            description: 'ID of the video to delete',
                        },
                    },
                    required: ['video_id'],
                },
            },
        ],
    };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
        switch (name) {
            case 'create_video': {
                const input = CreateVideoSchema.parse(args);
                const result = await createVideo(input);
                return { content: result };
            }
            case 'get_video_status': {
                const input = GetVideoStatusSchema.parse(args);
                const result = await getVideoStatus(input);
                return { content: result };
            }
            case 'list_videos': {
                const input = ListVideosSchema.parse(args);
                const result = await listVideos(input);
                return { content: result };
            }
            case 'download_video': {
                const input = DownloadVideoSchema.parse(args);
                const result = await downloadVideo(input);
                return { content: result };
            }
            case 'remix_video': {
                const input = RemixVideoSchema.parse(args);
                const result = await remixVideo(input);
                return { content: result };
            }
            case 'delete_video': {
                const input = DeleteVideoSchema.parse(args);
                const result = await deleteVideo(input);
                return { content: result };
            }
            default:
                return {
                    content: [{
                        type: 'text',
                        text: `Error: Unknown tool '${name}'`,
                    }],
                    isError: true,
                };
        }
    } catch (error: any) {
        const errorMessage = error instanceof z.ZodError
            ? `Invalid input: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`
            : error.message || String(error);

        return {
            content: [{
                type: 'text',
                text: `Error: ${errorMessage}`,
            }],
            isError: true,
        };
    }
});

// --- Server Execution ---
async function runServer() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('Sora Video MCP server started');
}

runServer().catch((error) => {
    console.error(`Server failed to start: ${error.message}`);
    process.exit(1);
});
