#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
    TextContent,
    ImageContent,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { writeFileSync, mkdirSync, existsSync, readFileSync, createReadStream } from 'fs';
import { join, resolve, dirname } from 'path';
import { createHash } from 'crypto';
import OpenAI from 'openai';

// --- Configuration ---
const DEFAULT_OUTPUT_DIR = process.cwd();

// --- Types ---
type OutputFormat = 'png' | 'jpeg' | 'webp';

const FORMAT_TO_MIME: Record<OutputFormat, string> = {
    png: 'image/png',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
};

const FORMAT_TO_EXT: Record<OutputFormat, string> = {
    png: '.png',
    jpeg: '.jpg',
    webp: '.webp',
};

// --- Helper Functions ---
function getApiKey(): string {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        throw new Error('OPENAI_API_KEY environment variable is required');
    }
    return apiKey;
}

function ensureDirectory(outputDirectory?: string): string {
    const dir = outputDirectory ? resolve(outputDirectory) : DEFAULT_OUTPUT_DIR;
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }
    return dir;
}

function generateFilename(prefix: string, prompt: string, format: OutputFormat = 'png', outputDir: string = DEFAULT_OUTPUT_DIR): string {
    const promptHash = createHash('md5').update(prompt).digest('hex').substring(0, 8);
    const timestamp = Date.now();
    const extension = FORMAT_TO_EXT[format];
    const filename = `${prefix}_${promptHash}_${timestamp}${extension}`;
    return join(outputDir, filename);
}

async function downloadImage(url: string, outputPath: string): Promise<void> {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to download image: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Ensure output directory exists
    ensureDirectory(dirname(outputPath));

    writeFileSync(outputPath, buffer);
}

function createImageResult(outputPath: string, format: OutputFormat = 'png'): Array<TextContent | ImageContent> {
    // Ensure we have an absolute path
    const absolutePath = resolve(outputPath);

    // Read image file and encode as base64
    const imageBuffer = readFileSync(absolutePath);
    const imageData = imageBuffer.toString('base64');
    const mimeType = FORMAT_TO_MIME[format];

    // Create summary with essential information
    const summary = {
        output_path: absolutePath,
        size_bytes: imageBuffer.length,
        format: mimeType,
    };

    return [
        {
            type: 'image',
            data: imageData,
            mimeType,
        } as ImageContent,
        {
            type: 'text',
            text: JSON.stringify(summary, null, 2),
        } as TextContent,
    ];
}

function isGptImageModel(model: string): boolean {
    return model.startsWith('gpt-image');
}

// --- MCP Server Setup ---
const server = new Server(
    {
        name: 'openai-image-server',
        version: '0.1.0',
    },
    {
        capabilities: {
            tools: {},
        },
    }
);

// --- Tool Schemas ---
const GenerateImageSchema = z.object({
    prompt: z.string().describe('Text description of the image to generate. Be specific about style, composition, lighting, and details. Max 32000 chars for GPT Image models.'),
    model: z.enum(['gpt-image-1', 'dall-e-3', 'dall-e-2']).optional().describe('Model: gpt-image-1 (best quality, default), dall-e-3 (good quality, supports style), dall-e-2 (fast, cheap)'),
    quality: z.enum(['low', 'medium', 'high']).optional().describe('Quality level for GPT Image models: low (~$0.02), medium (~$0.07, default), high (~$0.19). Higher = more detail.'),
    size: z.enum(['1024x1024', '1024x1536', '1536x1024', 'auto']).optional().describe('Image dimensions. 1024x1024 (square, default), 1024x1536 (portrait), 1536x1024 (landscape), auto (model decides)'),
    background: z.enum(['auto', 'transparent', 'opaque']).optional().describe('Background type for GPT Image models: transparent (for icons/sprites/overlays), opaque (solid background), auto (model decides)'),
    output_format: z.enum(['png', 'jpeg', 'webp']).optional().describe('Output format: png (lossless, supports transparency, default), jpeg (smaller, faster, no transparency), webp (good compression, supports transparency)'),
    output_compression: z.number().min(0).max(100).optional().describe('Compression level 0-100 for jpeg/webp (default: 100). Lower = smaller file but less quality.'),
    moderation: z.enum(['auto', 'low']).optional().describe('Content filtering: auto (standard filtering, default), low (less restrictive for artistic content)'),
    style: z.enum(['vivid', 'natural']).optional().describe('Style for DALL-E 3 only: vivid (hyper-real, dramatic), natural (more realistic, less exaggerated)'),
    n: z.number().min(1).max(10).optional().describe('Number of images to generate (1-10, default: 1). Useful for getting variations.'),
    output_path: z.string().optional().describe('Custom output file path. If not provided, auto-generates unique filename in current directory.'),
});

const EditImageSchema = z.object({
    image_path: z.string().describe('Path to source image file (PNG, WebP, or JPG). Max 50MB for GPT Image models, 4MB for DALL-E.'),
    prompt: z.string().describe('Text description of the desired edit. Describe what should appear in the edited regions or overall changes.'),
    mask_path: z.string().optional().describe('Path to mask image (PNG with transparency). Transparent areas = regions to edit. If omitted, model edits based on prompt.'),
    model: z.enum(['gpt-image-1', 'dall-e-2']).optional().describe('Model: gpt-image-1 (best quality, default), dall-e-2 (faster, cheaper). Note: DALL-E 3 does not support editing.'),
    quality: z.enum(['low', 'medium', 'high']).optional().describe('Quality level for GPT Image models: low, medium (default), high'),
    size: z.enum(['1024x1024', '1024x1536', '1536x1024', 'auto']).optional().describe('Output dimensions: 1024x1024 (default), 1024x1536 (portrait), 1536x1024 (landscape), auto'),
    background: z.enum(['auto', 'transparent', 'opaque']).optional().describe('Background type for GPT Image models: transparent, opaque, auto (default)'),
    output_format: z.enum(['png', 'jpeg', 'webp']).optional().describe('Output format: png (default, supports transparency), jpeg (smaller), webp (balanced)'),
    output_compression: z.number().min(0).max(100).optional().describe('Compression 0-100 for jpeg/webp (default: 100)'),
    n: z.number().min(1).max(10).optional().describe('Number of edit variations to generate (1-10, default: 1)'),
    output_path: z.string().optional().describe('Custom output file path (auto-generated if not provided)'),
});

// --- Tools Implementation ---
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: 'generate_image',
                description: `Generate images from text prompts using OpenAI's GPT Image API.

CAPABILITIES:
- Create any image from detailed text descriptions
- Generate icons, illustrations, photos, art, diagrams, sprites
- Support transparent backgrounds for compositing
- Multiple quality levels and output formats

BEST PRACTICES:
- Be specific in prompts: describe style, composition, lighting, colors, mood
- Use "transparent" background for icons, sprites, UI elements, or images to overlay
- Use "high" quality for final assets, "low" for quick drafts
- Use jpeg format for photos (smaller files), png for graphics with transparency

COMMON USE CASES:
- App icons: set background="transparent", size="1024x1024"
- Hero images: set quality="high", size="1536x1024"
- Thumbnails: set quality="low", output_format="jpeg"
- Sprites/game assets: set background="transparent", output_format="png"`,
                inputSchema: {
                    type: 'object',
                    properties: {
                        prompt: {
                            type: 'string',
                            description: 'Detailed text description of the image. Include style, subject, composition, lighting, colors, and mood.',
                        },
                        model: {
                            type: 'string',
                            enum: ['gpt-image-1', 'dall-e-3', 'dall-e-2'],
                            description: 'Model: gpt-image-1 (best, default), dall-e-3 (supports style param), dall-e-2 (fast/cheap)',
                        },
                        quality: {
                            type: 'string',
                            enum: ['low', 'medium', 'high'],
                            description: 'Quality for GPT Image: low (~$0.02), medium (~$0.07, default), high (~$0.19)',
                        },
                        size: {
                            type: 'string',
                            enum: ['1024x1024', '1024x1536', '1536x1024', 'auto'],
                            description: 'Dimensions: 1024x1024 (square, default), 1024x1536 (portrait), 1536x1024 (landscape)',
                        },
                        background: {
                            type: 'string',
                            enum: ['auto', 'transparent', 'opaque'],
                            description: 'Background: transparent (icons/sprites), opaque (solid), auto (default)',
                        },
                        output_format: {
                            type: 'string',
                            enum: ['png', 'jpeg', 'webp'],
                            description: 'Format: png (lossless, transparency, default), jpeg (smaller, no transparency), webp (balanced)',
                        },
                        output_compression: {
                            type: 'number',
                            description: 'Compression 0-100 for jpeg/webp (100 = best quality, default)',
                        },
                        moderation: {
                            type: 'string',
                            enum: ['auto', 'low'],
                            description: 'Content filter: auto (standard, default), low (less restrictive)',
                        },
                        style: {
                            type: 'string',
                            enum: ['vivid', 'natural'],
                            description: 'DALL-E 3 only: vivid (dramatic), natural (realistic)',
                        },
                        n: {
                            type: 'number',
                            description: 'Number of images 1-10 (default: 1)',
                        },
                        output_path: {
                            type: 'string',
                            description: 'Custom output path (auto-generated if omitted)',
                        },
                    },
                    required: ['prompt'],
                },
            },
            {
                name: 'edit_image',
                description: `Edit existing images using OpenAI's GPT Image API.

CAPABILITIES:
- Modify specific regions of an image using a mask
- Extend or outpaint images
- Remove or replace objects
- Change backgrounds
- Apply style transformations

HOW MASKS WORK:
- Create a PNG with transparent regions where you want edits
- Opaque regions are preserved, transparent regions are regenerated
- If no mask provided, the model interprets the prompt to decide what to change

BEST PRACTICES:
- Provide clear, specific prompts describing the desired result
- Use masks for precise control over edited regions
- Match output size to input for best quality`,
                inputSchema: {
                    type: 'object',
                    properties: {
                        image_path: {
                            type: 'string',
                            description: 'Path to source image (PNG, WebP, JPG). Max 50MB.',
                        },
                        prompt: {
                            type: 'string',
                            description: 'Description of desired edit or what should appear in masked regions.',
                        },
                        mask_path: {
                            type: 'string',
                            description: 'Path to mask PNG. Transparent areas = edit regions. Optional.',
                        },
                        model: {
                            type: 'string',
                            enum: ['gpt-image-1', 'dall-e-2'],
                            description: 'Model: gpt-image-1 (best, default), dall-e-2 (faster). DALL-E 3 not supported.',
                        },
                        quality: {
                            type: 'string',
                            enum: ['low', 'medium', 'high'],
                            description: 'Quality for GPT Image: low, medium (default), high',
                        },
                        size: {
                            type: 'string',
                            enum: ['1024x1024', '1024x1536', '1536x1024', 'auto'],
                            description: 'Output size: 1024x1024 (default), 1024x1536, 1536x1024, auto',
                        },
                        background: {
                            type: 'string',
                            enum: ['auto', 'transparent', 'opaque'],
                            description: 'Background type for GPT Image models',
                        },
                        output_format: {
                            type: 'string',
                            enum: ['png', 'jpeg', 'webp'],
                            description: 'Output format: png (default), jpeg, webp',
                        },
                        output_compression: {
                            type: 'number',
                            description: 'Compression 0-100 for jpeg/webp',
                        },
                        n: {
                            type: 'number',
                            description: 'Number of variations 1-10 (default: 1)',
                        },
                        output_path: {
                            type: 'string',
                            description: 'Custom output path (auto-generated if omitted)',
                        },
                    },
                    required: ['image_path', 'prompt'],
                },
            },
        ],
    };
});

// --- Tool Handlers ---
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
        switch (name) {
            case 'generate_image': {
                const {
                    prompt,
                    model = 'gpt-image-1',
                    quality = 'medium',
                    size = '1024x1024',
                    background,
                    output_format = 'png',
                    output_compression,
                    moderation,
                    style,
                    n = 1,
                    output_path,
                } = GenerateImageSchema.parse(args);

                const apiKey = getApiKey();
                const openai = new OpenAI({ apiKey });

                try {
                    // Build request parameters
                    const requestParams: any = {
                        model,
                        prompt,
                        n,
                    };

                    if (isGptImageModel(model)) {
                        // GPT Image model parameters
                        requestParams.quality = quality;
                        requestParams.size = size;
                        requestParams.output_format = output_format;

                        if (background) {
                            requestParams.background = background;
                        }
                        if (output_compression !== undefined && (output_format === 'jpeg' || output_format === 'webp')) {
                            requestParams.output_compression = output_compression;
                        }
                        if (moderation) {
                            requestParams.moderation = moderation;
                        }
                    } else {
                        // DALL-E models
                        const dalleSizes = ['256x256', '512x512', '1024x1024', '1792x1024', '1024x1792'];
                        requestParams.size = dalleSizes.includes(size) ? size : '1024x1024';
                        requestParams.response_format = 'url';

                        // DALL-E 3 supports style
                        if (model === 'dall-e-3' && style) {
                            requestParams.style = style;
                        }
                    }

                    const response = await openai.images.generate(requestParams);

                    if (!response.data || response.data.length === 0) {
                        throw new Error('No image data returned from OpenAI');
                    }

                    // Handle multiple images
                    const results: Array<TextContent | ImageContent> = [];

                    for (let i = 0; i < response.data.length; i++) {
                        const imageData = response.data[i];
                        const imageUrl = imageData.url;
                        const imageB64 = imageData.b64_json;

                        // Generate output filename
                        const suffix = n > 1 ? `_${i + 1}` : '';
                        const outputFile = output_path && n === 1
                            ? resolve(output_path)
                            : generateFilename(`openai_generated${suffix}`, prompt, output_format, DEFAULT_OUTPUT_DIR);

                        if (imageB64) {
                            // GPT Image models return base64
                            const buffer = Buffer.from(imageB64, 'base64');
                            ensureDirectory(dirname(outputFile));
                            writeFileSync(outputFile, buffer);
                        } else if (imageUrl) {
                            // DALL-E models return URLs
                            await downloadImage(imageUrl, outputFile);
                        } else {
                            throw new Error('No image data returned from OpenAI');
                        }

                        const imageResults = createImageResult(outputFile, output_format);
                        results.push(...imageResults);
                    }

                    return {
                        content: results,
                    };

                } catch (error) {
                    return {
                        content: [
                            {
                                type: 'text',
                                text: `Error generating image: ${error instanceof Error ? error.message : String(error)}\nModel: ${model}\nPrompt: ${prompt}`,
                            },
                        ],
                        isError: true,
                    };
                }
            }

            case 'edit_image': {
                const {
                    image_path,
                    mask_path,
                    prompt,
                    model = 'gpt-image-1',
                    quality = 'medium',
                    size = '1024x1024',
                    background,
                    output_format = 'png',
                    output_compression,
                    n = 1,
                    output_path,
                } = EditImageSchema.parse(args);

                const apiKey = getApiKey();
                const openai = new OpenAI({ apiKey });

                try {
                    // Verify image file exists
                    const resolvedImagePath = resolve(image_path);
                    if (!existsSync(resolvedImagePath)) {
                        throw new Error(`Image file not found: ${resolvedImagePath}`);
                    }

                    // Build request parameters
                    const requestParams: any = {
                        model,
                        image: createReadStream(resolvedImagePath) as any,
                        prompt,
                        n,
                    };

                    if (isGptImageModel(model)) {
                        // GPT Image model parameters
                        requestParams.quality = quality;
                        requestParams.size = size;
                        requestParams.output_format = output_format;

                        if (background) {
                            requestParams.background = background;
                        }
                        if (output_compression !== undefined && (output_format === 'jpeg' || output_format === 'webp')) {
                            requestParams.output_compression = output_compression;
                        }
                        // Note: moderation is NOT supported for edit endpoint
                    } else {
                        // DALL-E 2 parameters
                        const dalleSizes = ['256x256', '512x512', '1024x1024'];
                        requestParams.size = dalleSizes.includes(size) ? size : '1024x1024';
                        requestParams.response_format = 'url';
                    }

                    // Add mask if provided
                    if (mask_path) {
                        const resolvedMaskPath = resolve(mask_path);
                        if (!existsSync(resolvedMaskPath)) {
                            throw new Error(`Mask file not found: ${resolvedMaskPath}`);
                        }
                        requestParams.mask = createReadStream(resolvedMaskPath) as any;
                    }

                    const response = await openai.images.edit(requestParams);

                    if (!response.data || response.data.length === 0) {
                        throw new Error('No image data returned from OpenAI');
                    }

                    // Handle multiple images
                    const results: Array<TextContent | ImageContent> = [];

                    for (let i = 0; i < response.data.length; i++) {
                        const imageData = response.data[i];
                        const imageUrl = imageData.url;
                        const imageB64 = imageData.b64_json;

                        // Generate output filename
                        const suffix = n > 1 ? `_${i + 1}` : '';
                        const outputFile = output_path && n === 1
                            ? resolve(output_path)
                            : generateFilename(`openai_edited${suffix}`, prompt, output_format, DEFAULT_OUTPUT_DIR);

                        if (imageB64) {
                            // GPT Image models return base64
                            const buffer = Buffer.from(imageB64, 'base64');
                            ensureDirectory(dirname(outputFile));
                            writeFileSync(outputFile, buffer);
                        } else if (imageUrl) {
                            // DALL-E models return URLs
                            await downloadImage(imageUrl, outputFile);
                        } else {
                            continue; // Skip if no image data
                        }

                        const imageResults = createImageResult(outputFile, output_format);
                        results.push(...imageResults);
                    }

                    return {
                        content: results,
                    };

                } catch (error) {
                    return {
                        content: [
                            {
                                type: 'text',
                                text: `Error editing image: ${error instanceof Error ? error.message : String(error)}\nModel: ${model}\nPrompt: ${prompt}`,
                            },
                        ],
                        isError: true,
                    };
                }
            }

            default:
                throw new Error(`Unknown tool: ${name}`);
        }
    } catch (error) {
        return {
            content: [
                {
                    type: 'text',
                    text: `Error: ${error instanceof Error ? error.message : String(error)}`,
                },
            ],
            isError: true,
        };
    }
});

// --- Main Function ---
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('OpenAI Image MCP Server v0.1.0 running on stdio');
}

main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
