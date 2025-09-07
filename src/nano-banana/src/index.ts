#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
    CallToolResultSchema,
    TextContent,
    ImageContent,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { writeFileSync, mkdirSync, existsSync, readFileSync, statSync } from 'fs';
import { join, extname, resolve, dirname } from 'path';
import { createHash } from 'crypto';
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';

// --- Configuration ---
const MODEL_NAME = 'gemini-2.5-flash-image-preview';
const SUPPORTED_IMAGE_FORMATS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'] as const;
const MAX_IMAGE_SIZE_MB = 20;
const DEFAULT_OUTPUT_DIR = process.cwd();

// --- Helper Functions ---
function getApiKey(): string {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY environment variable is required');
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

function generateFilename(prefix: string, prompt: string, extension: string = '.png', outputDir: string = DEFAULT_OUTPUT_DIR): string {
    const promptHash = createHash('md5').update(prompt).digest('hex').substring(0, 8);
    const timestamp = Date.now();
    const filename = `${prefix}_${promptHash}_${timestamp}${extension}`;
    return join(outputDir, filename);
}

function validateImageFile(imagePath: string): void {
    const resolvedPath = resolve(imagePath);
    if (!existsSync(resolvedPath)) {
        throw new Error(`Image file not found: ${resolvedPath}`);
    }
    
    const ext = extname(resolvedPath).toLowerCase();
    if (!SUPPORTED_IMAGE_FORMATS.includes(ext as any)) {
        throw new Error(`Unsupported image format: ${ext}. Supported formats: ${SUPPORTED_IMAGE_FORMATS.join(', ')}`);
    }
    
    const stats = statSync(resolvedPath);
    const sizeMB = stats.size / (1024 * 1024);
    if (sizeMB > MAX_IMAGE_SIZE_MB) {
        throw new Error(`Image file too large: ${sizeMB.toFixed(2)}MB. Maximum size: ${MAX_IMAGE_SIZE_MB}MB`);
    }
}

function encodeImageToBase64(imagePath: string): string {
    const resolvedPath = resolve(imagePath);
    const imageBuffer = readFileSync(resolvedPath);
    return imageBuffer.toString('base64');
}

function getMimeType(imagePath: string): string {
    const ext = extname(imagePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.webp': 'image/webp',
        '.gif': 'image/gif'
    } as const;
    return mimeTypes[ext] || 'image/jpeg';
}

function createOutputPath(outputPath: string | undefined, prefix: string, prompt: string, extension: string): string {
    if (outputPath) {
        return resolve(outputPath);
    }
    return generateFilename(prefix, prompt, extension, DEFAULT_OUTPUT_DIR);
}

function createImageResult(outputPath: string): Array<TextContent | ImageContent> {
    // Ensure we have an absolute path
    const absolutePath = resolve(outputPath);
    
    // Read image file and encode as base64
    const imageBuffer = readFileSync(absolutePath);
    const imageData = imageBuffer.toString('base64');
    const mimeType = getMimeType(absolutePath);
    
    // Create summary with only essential information
    const summary = {
        output_path: absolutePath,
        size_bytes: imageBuffer.length,
        format: mimeType
    };
    
    return [
        {
            type: 'image',
            data: imageData,
            mimeType: mimeType
        } as ImageContent,
        {
            type: 'text',
            text: JSON.stringify(summary, null, 2)
        } as TextContent
    ];
}

// --- MCP Server Setup ---
const server = new Server(
    {
        name: 'nano-banana-server',
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
    prompt: z.string().describe('Text prompt describing the image to generate. Be specific about style, composition, lighting, and any other visual elements.'),
    output_path: z.string().optional().describe('Output file path (auto-generated if not provided)'),
});

const ProcessImageSchema = z.object({
    image_path: z.string().describe('Path to the input image file'),
    prompt: z.string().describe('Detailed instruction for what to do with the image. Examples: "Remove the red car in the background", "Change the background to a beach sunset", "Apply Van Gogh painting style", "Add a rainbow in the sky", "Transform this person into a mini figurine on a desk"'),
    output_path: z.string().optional().describe('Output file path (auto-generated if not provided)'),
});

const ProcessMultipleImagesSchema = z.object({
    image_paths: z.array(z.string()).min(2).describe('Array of image file paths to process together'),
    prompt: z.string().describe('Detailed instruction for how to combine or process the images together. Examples: "Place the person from the first image into the landscape from the second image", "Create a collage with these images in a grid layout", "Blend these images to create a surreal composition"'),
    output_path: z.string().optional().describe('Output file path (auto-generated if not provided)'),
});

// --- Tools Implementation ---
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: 'generate_image',
                description: 'Generate a new image from a text prompt using Google\'s Gemini 2.5 Flash Image model. Be specific in your prompt about style, composition, lighting, colors, and any other visual elements you want.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        prompt: {
                            type: 'string',
                            description: 'Text prompt describing the image to generate. Be specific about style, composition, lighting, and any other visual elements.'
                        },
                        output_path: {
                            type: 'string',
                            description: 'Output file path (auto-generated if not provided)'
                        }
                    },
                    required: ['prompt']
                }
            },
            {
                name: 'process_image',
                description: 'Process an existing image based on detailed instructions. This tool can handle any image editing task including object removal, background changes, style transfer, adding elements, and more. The key is to provide clear, specific instructions in the prompt.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        image_path: {
                            type: 'string',
                            description: 'Path to the input image file'
                        },
                        prompt: {
                            type: 'string',
                            description: 'Detailed instruction for what to do with the image. Examples: "Remove the red car in the background", "Change the background to a beach sunset", "Apply Van Gogh painting style", "Add a rainbow in the sky", "Transform this person into a mini figurine on a desk"'
                        },
                        output_path: {
                            type: 'string',
                            description: 'Output file path (auto-generated if not provided)'
                        }
                    },
                    required: ['image_path', 'prompt']
                }
            },
            {
                name: 'process_multiple_images',
                description: 'Process multiple images together based on detailed instructions. This tool can combine images, create collages, blend compositions, or perform any multi-image operation. Provide clear instructions on how the images should be combined or processed.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        image_paths: {
                            type: 'array',
                            items: { type: 'string' },
                            minItems: 2,
                            description: 'Array of image file paths to process together'
                        },
                        prompt: {
                            type: 'string',
                            description: 'Detailed instruction for how to combine or process the images together. Examples: "Place the person from the first image into the landscape from the second image", "Create a collage with these images in a grid layout", "Blend these images to create a surreal composition"'
                        },
                        output_path: {
                            type: 'string',
                            description: 'Output file path (auto-generated if not provided)'
                        }
                    },
                    required: ['image_paths', 'prompt']
                }
            }
        ]
    };
});

// --- Tool Handlers ---
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
        switch (name) {
            case 'generate_image': {
                const { prompt, output_path } = GenerateImageSchema.parse(args);
                
                const apiKey = getApiKey();
                const genAI = new GoogleGenerativeAI(apiKey);
                const model = genAI.getGenerativeModel({ model: MODEL_NAME });

                try {
                    const result = await model.generateContent(prompt);
                    const response = await result.response;
                    
                    // Check if the response contains image data
                    const candidates = response.candidates;
                    if (candidates && candidates.length > 0) {
                        const candidate = candidates[0];
                        const parts = candidate.content.parts;
                        
                        for (const part of parts) {
                            if (part.inlineData) {
                                // Found image data
                                const imageData = part.inlineData.data;
                                const mimeType = part.inlineData.mimeType;
                                
                                // Determine file extension from mime type
                                const extension = mimeType === 'image/jpeg' ? '.jpg' : 
                                               mimeType === 'image/png' ? '.png' : 
                                               mimeType === 'image/webp' ? '.webp' : '.jpg';
                                
                                const outputFile = createOutputPath(output_path, 'generated', prompt, extension);
                                
                                // Ensure output directory exists
                                ensureDirectory(dirname(outputFile));
                                
                                // Save the image data
                                const imageBuffer = Buffer.from(imageData, 'base64');
                                writeFileSync(outputFile, imageBuffer);
                                
                                return {
                                    content: createImageResult(outputFile)
                                };
                            }
                        }
                    }
                    
                    // If no image data found, return text response
                    const text = response.text();
                    return {
                        content: [
                            {
                                type: 'text',
                                text: `Generated content: ${text}\nPrompt: ${prompt}\nNote: No image data was returned. This might be a text-only model response.`
                            }
                        ]
                    };
                    
                } catch (error) {
                    return {
                        content: [
                            {
                                type: 'text',
                                text: `Error generating image: ${error instanceof Error ? error.message : String(error)}\nPrompt: ${prompt}`
                            }
                        ],
                        isError: true
                    };
                }
            }

            case 'process_image': {
                const { image_path, prompt, output_path } = ProcessImageSchema.parse(args);
                
                const resolvedImagePath = resolve(image_path);
                validateImageFile(resolvedImagePath);
                
                const apiKey = getApiKey();
                const genAI = new GoogleGenerativeAI(apiKey);
                const model = genAI.getGenerativeModel({ model: MODEL_NAME });

                const imageData = encodeImageToBase64(resolvedImagePath);
                const mimeType = getMimeType(resolvedImagePath);

                try {
                    const result = await model.generateContent([
                        {
                            text: prompt
                        },
                        {
                            inlineData: {
                                data: imageData,
                                mimeType: mimeType
                            }
                        }
                    ]);

                    const response = await result.response;
                    
                    // Check if the response contains image data
                    const candidates = response.candidates;
                    if (candidates && candidates.length > 0) {
                        const candidate = candidates[0];
                        const parts = candidate.content.parts;
                        
                        for (const part of parts) {
                            if (part.inlineData) {
                                // Found image data
                                const responseImageData = part.inlineData.data;
                                const responseMimeType = part.inlineData.mimeType;
                                
                                // Determine file extension from mime type
                                const extension = responseMimeType === 'image/jpeg' ? '.jpg' : 
                                               responseMimeType === 'image/png' ? '.png' : 
                                               responseMimeType === 'image/webp' ? '.webp' : extname(image_path);
                                
                                const outputFile = createOutputPath(output_path, 'processed', prompt, extension);
                                
                                // Ensure output directory exists
                                ensureDirectory(dirname(outputFile));
                                
                                // Save the processed image data
                                const imageBuffer = Buffer.from(responseImageData, 'base64');
                                writeFileSync(outputFile, imageBuffer);
                                
                                return {
                                    content: createImageResult(outputFile)
                                };
                            }
                        }
                    }
                    
                    // If no image data found, return text response
                    const text = response.text();
                    return {
                        content: [
                            {
                                type: 'text',
                                text: `Processing response: ${text}\nInstruction: ${prompt}\nNote: No image data was returned. This might be a text-only model response.`
                            }
                        ]
                    };
                    
                } catch (error) {
                    return {
                        content: [
                            {
                                type: 'text',
                                text: `Error processing image: ${error instanceof Error ? error.message : String(error)}\nInstruction: ${prompt}`
                            }
                        ],
                        isError: true
                    };
                }
            }

            case 'process_multiple_images': {
                const { image_paths, prompt, output_path } = ProcessMultipleImagesSchema.parse(args);
                
                // Validate all input images and resolve paths
                const resolvedImagePaths = image_paths.map(path => {
                    const resolved = resolve(path);
                    validateImageFile(resolved);
                    return resolved;
                });
                
                const apiKey = getApiKey();
                const genAI = new GoogleGenerativeAI(apiKey);
                const model = genAI.getGenerativeModel({ model: MODEL_NAME });

                // Prepare image data for all input images
                const imageParts = resolvedImagePaths.map(path => ({
                    inlineData: {
                        data: encodeImageToBase64(path),
                        mimeType: getMimeType(path)
                    }
                }));

                try {
                    const result = await model.generateContent([
                        { text: prompt },
                        ...imageParts
                    ]);

                    const response = await result.response;
                    
                    // Check if the response contains image data
                    const candidates = response.candidates;
                    if (candidates && candidates.length > 0) {
                        const candidate = candidates[0];
                        const parts = candidate.content.parts;
                        
                        for (const part of parts) {
                            if (part.inlineData) {
                                // Found image data
                                const responseImageData = part.inlineData.data;
                                const responseMimeType = part.inlineData.mimeType;
                                
                                // Determine file extension from mime type
                                const extension = responseMimeType === 'image/jpeg' ? '.jpg' : 
                                               responseMimeType === 'image/png' ? '.png' : 
                                               responseMimeType === 'image/webp' ? '.webp' : '.jpg';
                                
                                const outputFile = createOutputPath(output_path, 'combined', prompt, extension);
                                
                                // Ensure output directory exists
                                ensureDirectory(dirname(outputFile));
                                
                                // Save the combined image data
                                const imageBuffer = Buffer.from(responseImageData, 'base64');
                                writeFileSync(outputFile, imageBuffer);
                                
                                return {
                                    content: createImageResult(outputFile)
                                };
                            }
                        }
                    }
                    
                    // If no image data found, return text response
                    const text = response.text();
                    return {
                        content: [
                            {
                                type: 'text',
                                text: `Combination response: ${text}\nInstruction: ${prompt}\nProcessed ${image_paths.length} images\nNote: No image data was returned. This might be a text-only model response.`
                            }
                        ]
                    };
                    
                } catch (error) {
                    return {
                        content: [
                            {
                                type: 'text',
                                text: `Error combining images: ${error instanceof Error ? error.message : String(error)}\nInstruction: ${prompt}`
                            }
                        ],
                        isError: true
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
                    text: `Error: ${error instanceof Error ? error.message : String(error)}`
                }
            ],
            isError: true
        };
    }
});

// Note: MCP Prompts are not implemented in this TypeScript version
// The server focuses on core tools for image generation and editing

// --- Main Function ---
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('Nano Banana MCP Server running on stdio');
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch((error) => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}
