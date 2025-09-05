#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
    CallToolResultSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';

// --- Configuration ---
const VOICES = {
    Zephyr: 'Bright and energetic',
    Puck: 'Upbeat and cheerful',
    Charon: 'Informative and clear',
    Kore: 'Firm and authoritative',
    Fenrir: 'Excitable and dynamic',
    Leda: 'Youthful and fresh',
    Orus: 'Firm and confident',
    Aoede: 'Breezy and light',
    Callirrhoe: 'Easy-going and relaxed',
    Autonoe: 'Bright and optimistic',
    Enceladus: 'Breathy and intimate',
    Iapetus: 'Clear and articulate',
    Umbriel: 'Easy-going and friendly',
    Algieba: 'Smooth and polished',
    Despina: 'Smooth and elegant',
    Erinome: 'Clear and precise',
    Algenib: 'Gravelly and distinctive',
    Rasalgethi: 'Informative and knowledgeable',
    Laomedeia: 'Upbeat and lively',
    Achernar: 'Soft and gentle',
    Alnilam: 'Firm and steady',
    Schedar: 'Even and balanced',
    Gacrux: 'Mature and experienced',
    Pulcherrima: 'Forward and engaging',
    Achird: 'Friendly and warm',
    Zubenelgenubi: 'Casual and approachable',
    Vindemiatrix: 'Gentle and soothing',
    Sadachbia: 'Lively and animated',
    Sadaltager: 'Knowledgeable and wise',
    Sulafat: 'Warm and inviting',
} as const;

// --- Helper Functions ---
function getApiKey(): string {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY environment variable is required');
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

function generateFilename(prefix: string, text: string): string {
    const textHash = createHash('md5').update(text).digest('hex').substring(0, 8);
    const timestamp = Date.now();
    return `${prefix}_${textHash}_${timestamp}.wav`;
}

function createWAVHeader(pcmData: Buffer, sampleRate: number = 24000): Buffer {
    const channels = 1;
    const bitsPerSample = 16;
    const byteRate = (sampleRate * channels * bitsPerSample) / 8;
    const blockAlign = (channels * bitsPerSample) / 8;

    const header = Buffer.alloc(44);
    header.write('RIFF', 0);
    header.writeUInt32LE(36 + pcmData.length, 4);
    header.write('WAVE', 8);
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(channels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(byteRate, 28);
    header.writeUInt16LE(blockAlign, 32);
    header.writeUInt16LE(bitsPerSample, 34);
    header.write('data', 36);
    header.writeUInt32LE(pcmData.length, 40);

    return Buffer.concat([header, pcmData]);
}

function generateDummyAudio(durationSeconds: number = 2.0): Buffer {
    const sampleRate = 24000;
    const samples = Math.floor(sampleRate * durationSeconds);
    const frequency = 440;
    const amplitude = 0.1;

    const pcmData = Buffer.alloc(samples * 2);
    for (let i = 0; i < samples; i++) {
        const sample = Math.sin((2 * Math.PI * frequency * i) / sampleRate) * amplitude;
        const intSample = Math.floor(sample * 32767);
        pcmData.writeInt16LE(intSample, i * 2);
    }

    return createWAVHeader(pcmData, sampleRate);
}

// --- Tool Schemas ---
const GenerateSpeechSchema = z.object({
    text: z.string().min(1).describe('Text to convert to speech'),
    voice: z.enum(Object.keys(VOICES) as [string, ...string[]]).describe('Voice to use for speech generation'),
    tone: z.string().optional().describe('Optional tone instruction (e.g., "Say cheerfully:", "Speak in a formal tone:")'),
    output_directory: z.string().optional().describe('Directory to save the audio file (defaults to current directory)'),
});

const GenerateConversationSchema = z.object({
    text: z.string().min(1).describe('Text with speaker labels (e.g., "Host: Welcome! Guest: Thank you!")'),
    speakers: z.array(z.object({
        name: z.string().describe('Speaker name (must match labels in text)'),
        voice: z.enum(Object.keys(VOICES) as [string, ...string[]]).describe('Voice to use for this speaker'),
    })).min(1).describe('List of speakers with their assigned voices'),
    output_directory: z.string().optional().describe('Directory to save the audio file (defaults to current directory)'),
});

// --- Core Functions ---
async function generateSpeech(input: z.infer<typeof GenerateSpeechSchema>) {
    const { text, voice, tone, output_directory } = input;
    const apiKey = getApiKey();
    
    try {
        const fullText = tone ? `${tone} ${text}` : text;
        console.error(`Generating speech: "${fullText}" with voice: ${voice}`);

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: fullText }] }],
                    generationConfig: {
                        responseModalities: ['AUDIO'],
                        speechConfig: {
                            voiceConfig: {
                                prebuiltVoiceConfig: { voiceName: voice },
                            },
                        },
                    },
                }),
            }
        );

        if (!response.ok) {
            if (response.status === 429) {
                console.warn('Rate limit exceeded, returning dummy audio');
                const dummyAudio = generateDummyAudio();
                const outputPath = ensureDirectory(output_directory);
                const filename = generateFilename('dummy_speech', text);
                const filePath = join(outputPath, filename);
                
                writeFileSync(filePath, dummyAudio);
                
                return [
                    {
                        type: 'text',
                        text: `⚠️ Rate limit exceeded, returning dummy audio\n📁 Saved: ${filePath}\n⏱️ Duration: 2.0s\n🎤 Voice: ${voice} (${VOICES[voice as keyof typeof VOICES]})`,
                    },
                    {
                        type: 'audio',
                        data: dummyAudio.toString('base64'),
                        mimeType: 'audio/wav',
                    },
                ];
            }
            throw new Error(`API request failed: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        const audioData = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        
        if (!audioData) {
            throw new Error('No audio data received from Gemini API');
        }

        const pcmBuffer = Buffer.from(audioData, 'base64');
        const wavBuffer = createWAVHeader(pcmBuffer);
        
        const outputPath = ensureDirectory(output_directory);
        const filename = generateFilename('speech', text);
        const filePath = join(outputPath, filename);
        
        writeFileSync(filePath, wavBuffer);
        
        const duration = (wavBuffer.length / 48000).toFixed(2);
        const voiceDescription = VOICES[voice as keyof typeof VOICES];

        return [
            {
                type: 'text',
                text: `🎵 Speech generated successfully\n📁 Saved: ${filePath}\n⏱️ Duration: ${duration}s\n🎤 Voice: ${voice} (${voiceDescription})`,
            },
            {
                type: 'audio',
                data: wavBuffer.toString('base64'),
                mimeType: 'audio/wav',
            },
        ];
    } catch (error: any) {
        console.error('Error generating speech:', error);
        throw new Error(`Failed to generate speech: ${error.message}`);
    }
}

async function generateConversation(input: z.infer<typeof GenerateConversationSchema>) {
    const { text, speakers, output_directory } = input;
    const apiKey = getApiKey();
    
    try {
        console.error(`Generating conversation: "${text}" with ${speakers.length} speakers`);

        const speakerVoiceConfigs = speakers.map((speaker) => ({
            speaker: speaker.name,
            voiceConfig: {
                prebuiltVoiceConfig: { voiceName: speaker.voice },
            },
        }));

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text }] }],
                    generationConfig: {
                        responseModalities: ['AUDIO'],
                        speechConfig: {
                            multiSpeakerVoiceConfig: { speakerVoiceConfigs },
                        },
                    },
                }),
            }
        );

        if (!response.ok) {
            if (response.status === 429) {
                console.warn('Rate limit exceeded, returning dummy audio');
                const dummyAudio = generateDummyAudio();
                const outputPath = ensureDirectory(output_directory);
                const filename = generateFilename('dummy_conversation', text);
                const filePath = join(outputPath, filename);
                
                writeFileSync(filePath, dummyAudio);
                
                const speakerSummary = speakers
                    .map(s => `- ${s.name}: ${s.voice} (${VOICES[s.voice as keyof typeof VOICES]})`)
                    .join('\n');
                
                return [
                    {
                        type: 'text',
                        text: `⚠️ Rate limit exceeded, returning dummy audio\n📁 Saved: ${filePath}\n⏱️ Duration: 2.0s\n\n👥 Speakers:\n${speakerSummary}`,
                    },
                    {
                        type: 'audio',
                        data: dummyAudio.toString('base64'),
                        mimeType: 'audio/wav',
                    },
                ];
            }
            throw new Error(`API request failed: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        const audioData = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        
        if (!audioData) {
            throw new Error('No audio data received from Gemini API');
        }

        const pcmBuffer = Buffer.from(audioData, 'base64');
        const wavBuffer = createWAVHeader(pcmBuffer);
        
        const outputPath = ensureDirectory(output_directory);
        const filename = generateFilename('conversation', text);
        const filePath = join(outputPath, filename);
        
        writeFileSync(filePath, wavBuffer);
        
        const duration = (wavBuffer.length / 48000).toFixed(2);
        const speakerSummary = speakers
            .map(s => `- ${s.name}: ${s.voice} (${VOICES[s.voice as keyof typeof VOICES]})`)
            .join('\n');

        return [
            {
                type: 'text',
                text: `🎭 Conversation generated successfully\n📁 Saved: ${filePath}\n⏱️ Duration: ${duration}s\n\n👥 Speakers:\n${speakerSummary}`,
            },
            {
                type: 'audio',
                data: wavBuffer.toString('base64'),
                mimeType: 'audio/wav',
            },
        ];
    } catch (error: any) {
        console.error('Error generating conversation:', error);
        throw new Error(`Failed to generate conversation: ${error.message}`);
    }
}

function listVoices() {
    const voicesList = Object.entries(VOICES)
        .map(([name, description]) => `- **${name}**: ${description}`)
        .join('\n');
    
    return {
        type: 'text',
        text: `Available Gemini TTS Voices:\n\n${voicesList}\n\nUse these voice names in the 'voice' parameter when generating speech.`,
    };
}

// --- Server Setup ---
const server = new Server(
    { name: 'gemini-tts-server', version: '0.2.0' },
    { capabilities: { tools: {} } }
);

// --- Request Handlers ---
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: 'generate_speech',
                description: 'Generate speech from text using a single voice. Use this for monologues, announcements, or single-speaker content.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        text: {
                            type: 'string',
                            description: 'Text to convert to speech',
                        },
                        voice: {
                            type: 'string',
                            enum: Object.keys(VOICES),
                            description: 'Voice to use for speech generation',
                        },
                        tone: {
                            type: 'string',
                            description: 'Optional tone instruction (e.g., "Say cheerfully:", "Speak in a formal tone:")',
                        },
                        output_directory: {
                            type: 'string',
                            description: 'Directory to save the audio file (defaults to current directory)',
                        },
                    },
                    required: ['text', 'voice'],
                },
            },
            {
                name: 'generate_conversation',
                description: 'Generate multi-speaker conversation audio. Use this for dialogues, interviews, or any content with multiple speakers.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        text: {
                            type: 'string',
                            description: 'Text with speaker labels (e.g., "Host: Welcome! Guest: Thank you!")',
                        },
                        speakers: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    name: {
                                        type: 'string',
                                        description: 'Speaker name (must match labels in text)',
                                    },
                                    voice: {
                                        type: 'string',
                                        enum: Object.keys(VOICES),
                                        description: 'Voice to use for this speaker',
                                    },
                                },
                                required: ['name', 'voice'],
                            },
                            description: 'List of speakers with their assigned voices',
                        },
                        output_directory: {
                            type: 'string',
                            description: 'Directory to save the audio file (defaults to current directory)',
                        },
                    },
                    required: ['text', 'speakers'],
                },
            },
            {
                name: 'list_voices',
                description: 'Get a list of all available voices with their characteristics. Use this to choose the right voice for your content.',
                inputSchema: {
                    type: 'object',
                    properties: {},
                },
            },
        ],
    };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
        switch (name) {
            case 'generate_speech': {
                const input = GenerateSpeechSchema.parse(args);
                const result = await generateSpeech(input);
                return { content: result };
            }
            case 'generate_conversation': {
                const input = GenerateConversationSchema.parse(args);
                const result = await generateConversation(input);
                return { content: result };
            }
            case 'list_voices': {
                const result = listVoices();
                return { content: [result] };
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
    console.error('Gemini TTS MCP server started');
}

runServer().catch((error) => {
    console.error(`Server failed to start: ${error.message}`);
    process.exit(1);
});