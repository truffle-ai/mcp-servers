#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
    ImageContent,
    TextContent,
} from '@modelcontextprotocol/sdk/types.js';
import { createUIResource } from '@mcp-ui/server';
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { stream } from 'hono/streaming';
import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import { createCanvas, Canvas } from 'canvas';
import { createRequire } from 'module';

// Use createRequire for CommonJS modules in ESM
const require = createRequire(import.meta.url);
// @ts-ignore - serverboy doesn't have types
const Gameboy = require('serverboy');

// --- Configuration ---
const STREAM_PORT = parseInt(process.env.GAMEBOY_STREAM_PORT || '3100', 10);
const STREAM_FPS = parseInt(process.env.GAMEBOY_STREAM_FPS || '15', 10);

// --- Types ---
enum GameBoyButton {
    UP = 'UP',
    DOWN = 'DOWN',
    LEFT = 'LEFT',
    RIGHT = 'RIGHT',
    A = 'A',
    B = 'B',
    START = 'START',
    SELECT = 'SELECT',
}

// --- GameBoy Emulator Class ---
class GameBoyEmulator {
    private gameboy: any;
    private canvas: Canvas;
    private romLoaded: boolean = false;
    private romPath?: string;
    private streamActive: boolean = false;
    private streamClients: Set<(frame: Buffer) => void> = new Set();

    constructor() {
        this.gameboy = new Gameboy();
        this.canvas = createCanvas(160, 144);
    }

    loadRom(romPath: string): void {
        const rom = fs.readFileSync(romPath);
        this.gameboy.loadRom(rom);
        this.romLoaded = true;
        this.romPath = romPath;
    }

    pressButton(button: GameBoyButton, durationFrames: number = 1): void {
        if (!this.romLoaded) throw new Error('No ROM loaded');

        const buttonMap: Record<GameBoyButton, number> = {
            [GameBoyButton.UP]: Gameboy.KEYMAP.UP,
            [GameBoyButton.DOWN]: Gameboy.KEYMAP.DOWN,
            [GameBoyButton.LEFT]: Gameboy.KEYMAP.LEFT,
            [GameBoyButton.RIGHT]: Gameboy.KEYMAP.RIGHT,
            [GameBoyButton.A]: Gameboy.KEYMAP.A,
            [GameBoyButton.B]: Gameboy.KEYMAP.B,
            [GameBoyButton.START]: Gameboy.KEYMAP.START,
            [GameBoyButton.SELECT]: Gameboy.KEYMAP.SELECT,
        };

        for (let i = 0; i < durationFrames; i++) {
            this.gameboy.pressKeys([buttonMap[button]]);
            this.gameboy.doFrame();
        }
        // Release button
        this.gameboy.doFrame();
    }

    doFrame(): void {
        if (!this.romLoaded) throw new Error('No ROM loaded');
        this.gameboy.doFrame();
    }

    getScreenAsBuffer(): Buffer {
        if (!this.romLoaded) throw new Error('No ROM loaded');

        const screenData = this.gameboy.getScreen();
        const ctx = this.canvas.getContext('2d');
        const imageData = ctx.createImageData(160, 144);

        for (let i = 0; i < screenData.length; i++) {
            imageData.data[i] = screenData[i];
        }

        ctx.putImageData(imageData, 0, 0);
        return this.canvas.toBuffer('image/png');
    }

    getScreenAsBase64(): string {
        return this.getScreenAsBuffer().toString('base64');
    }

    getRomPath(): string | undefined {
        return this.romPath;
    }

    isRomLoaded(): boolean {
        return this.romLoaded;
    }

    // --- Streaming methods ---
    startStream(): void {
        if (this.streamActive) return;
        this.streamActive = true;
        this.runStreamLoop();
    }

    stopStream(): void {
        this.streamActive = false;
        this.streamClients.clear();
    }

    isStreamActive(): boolean {
        return this.streamActive;
    }

    addStreamClient(callback: (frame: Buffer) => void): () => void {
        this.streamClients.add(callback);
        return () => this.streamClients.delete(callback);
    }

    private runStreamLoop(): void {
        if (!this.streamActive || !this.romLoaded) return;

        const frameInterval = Math.floor(1000 / STREAM_FPS);

        const tick = () => {
            if (!this.streamActive || !this.romLoaded) return;

            // Advance emulator frames to match real-time
            const framesToAdvance = Math.ceil(60 / STREAM_FPS);
            for (let i = 0; i < framesToAdvance; i++) {
                this.gameboy.doFrame();
            }

            // Get current frame and broadcast to clients
            if (this.streamClients.size > 0) {
                const frame = this.getScreenAsBuffer();
                for (const client of this.streamClients) {
                    try {
                        client(frame);
                    } catch {
                        this.streamClients.delete(client);
                    }
                }
            }

            setTimeout(tick, frameInterval);
        };

        tick();
    }
}

// --- Emulator Instance ---
const emulator = new GameBoyEmulator();

// --- HTTP Server for MJPEG Streaming ---
const app = new Hono();

// Health check
app.get('/health', (c) => c.json({ status: 'ok', romLoaded: emulator.isRomLoaded() }));

// Single frame endpoint (PNG)
app.get('/frame', (c) => {
    if (!emulator.isRomLoaded()) {
        return c.json({ error: 'No ROM loaded' }, 400);
    }
    const frame = emulator.getScreenAsBuffer();
    c.header('Content-Type', 'image/png');
    c.header('Cache-Control', 'no-cache');
    return c.body(frame);
});

// MJPEG stream endpoint
app.get('/stream', (c) => {
    if (!emulator.isRomLoaded()) {
        return c.json({ error: 'No ROM loaded' }, 400);
    }

    // Start streaming if not already active
    if (!emulator.isStreamActive()) {
        emulator.startStream();
    }

    c.header('Content-Type', 'multipart/x-mixed-replace; boundary=frame');
    c.header('Cache-Control', 'no-cache');
    c.header('Connection', 'keep-alive');

    return stream(c, async (stream) => {
        const sendFrame = async (frame: Buffer) => {
            try {
                const header = `--frame\r\nContent-Type: image/png\r\nContent-Length: ${frame.length}\r\n\r\n`;
                await stream.write(header);
                await stream.write(frame);
                await stream.write('\r\n');
            } catch {
                // Client disconnected
            }
        };

        const unsubscribe = emulator.addStreamClient(sendFrame);

        // Keep connection alive
        await new Promise<void>((resolve) => {
            stream.onAbort(() => {
                unsubscribe();
                resolve();
            });
        });
    });
});

// Start HTTP server
let httpServer: ReturnType<typeof serve> | null = null;

function startHttpServer(): string {
    if (httpServer) {
        return `http://localhost:${STREAM_PORT}`;
    }

    httpServer = serve({
        fetch: app.fetch,
        port: STREAM_PORT,
    });

    console.error(`GameBoy stream server running at http://localhost:${STREAM_PORT}`);
    return `http://localhost:${STREAM_PORT}`;
}

// --- Helper Functions ---
function getScreen(): ImageContent {
    return {
        type: 'image',
        data: emulator.getScreenAsBase64(),
        mimeType: 'image/png',
    };
}

function loadRom(romPath: string): ImageContent {
    if (!fs.existsSync(romPath)) {
        throw new Error(`ROM file not found: ${romPath}`);
    }
    emulator.loadRom(romPath);
    // Advance a few frames to initialize
    for (let i = 0; i < 5; i++) {
        emulator.doFrame();
    }
    return getScreen();
}

function pressButton(button: GameBoyButton, durationFrames: number): ImageContent {
    if (!emulator.isRomLoaded()) throw new Error('No ROM loaded');
    emulator.pressButton(button, durationFrames);
    return getScreen();
}

function waitFrames(frames: number): ImageContent {
    if (!emulator.isRomLoaded()) throw new Error('No ROM loaded');
    for (let i = 0; i < frames; i++) {
        emulator.doFrame();
    }
    return getScreen();
}

function listRoms(): TextContent {
    const romsDir = path.join(process.cwd(), 'roms');
    if (!fs.existsSync(romsDir)) {
        fs.mkdirSync(romsDir, { recursive: true });
    }
    const romFiles = fs
        .readdirSync(romsDir)
        .filter((file) => file.endsWith('.gb') || file.endsWith('.gbc'))
        .map((file) => ({
            name: file,
            path: path.join(romsDir, file),
        }));
    return {
        type: 'text',
        text: JSON.stringify(romFiles, null, 2),
    };
}

// --- Tool Definitions ---
const tools = [
    // Button tools
    ...Object.values(GameBoyButton).map((button) => ({
        name: `press_${button.toLowerCase()}`,
        description: `Press the ${button} button on the GameBoy`,
        inputSchema: {
            type: 'object' as const,
            properties: {
                duration_frames: {
                    type: 'number',
                    description: 'Number of frames to hold the button (default: 25)',
                    default: 25,
                },
            },
        },
    })),
    {
        name: 'wait_frames',
        description: 'Wait for a specified number of frames without pressing any button',
        inputSchema: {
            type: 'object' as const,
            properties: {
                frames: {
                    type: 'number',
                    description: 'Number of frames to wait (default: 100)',
                    default: 100,
                },
            },
            required: ['frames'],
        },
    },
    {
        name: 'load_rom',
        description: 'Load a GameBoy ROM file (.gb or .gbc)',
        inputSchema: {
            type: 'object' as const,
            properties: {
                rom_path: {
                    type: 'string',
                    description: 'Absolute path to the ROM file',
                },
            },
            required: ['rom_path'],
        },
    },
    {
        name: 'get_screen',
        description: 'Get the current GameBoy screen (advances one frame)',
        inputSchema: {
            type: 'object' as const,
            properties: {},
        },
    },
    {
        name: 'start_live_view',
        description:
            'Start a live video stream of the GameBoy screen. Returns an interactive UI component that shows the game in real-time.',
        inputSchema: {
            type: 'object' as const,
            properties: {},
        },
    },
    {
        name: 'stop_live_view',
        description: 'Stop the live video stream to save resources',
        inputSchema: {
            type: 'object' as const,
            properties: {},
        },
    },
    {
        name: 'is_rom_loaded',
        description: 'Check if a ROM is currently loaded',
        inputSchema: {
            type: 'object' as const,
            properties: {},
        },
    },
    {
        name: 'list_roms',
        description: 'List all ROM files in the roms/ directory',
        inputSchema: {
            type: 'object' as const,
            properties: {},
        },
    },
];

// --- MCP Server Setup ---
const server = new Server(
    {
        name: 'gameboy-server',
        version: '0.2.0',
    },
    {
        capabilities: {
            tools: {},
        },
    }
);

// List tools handler
server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools,
}));

// Call tool handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
        // Handle button press tools
        const buttonMatch = name.match(/^press_(.+)$/);
        if (buttonMatch) {
            const buttonName = buttonMatch[1].toUpperCase();
            if (buttonName in GameBoyButton) {
                const button = GameBoyButton[buttonName as keyof typeof GameBoyButton];
                const durationFrames = (args as any)?.duration_frames ?? 25;
                pressButton(button, durationFrames);

                // Always return screenshot - LLM needs to see the screen to make decisions
                // (live view is only for human users watching)
                const screen = getScreen();
                return {
                    content: [
                        screen,
                        { type: 'text', text: `Pressed ${button} for ${durationFrames} frames.` },
                    ],
                };
            }
        }

        // Handle other tools
        switch (name) {
            case 'wait_frames': {
                const frames = (args as any)?.frames ?? 100;
                waitFrames(frames);

                // Always return screenshot - LLM needs to see the screen
                const screen = getScreen();
                return {
                    content: [
                        screen,
                        { type: 'text', text: `Waited ${frames} frames.` },
                    ],
                };
            }

            case 'load_rom': {
                const romPath = (args as any)?.rom_path;
                if (!romPath) {
                    return {
                        content: [{ type: 'text', text: 'Error: rom_path is required' }],
                        isError: true,
                    };
                }
                const screen = loadRom(romPath);

                // Also start HTTP server when ROM is loaded
                startHttpServer();

                return { content: [screen] };
            }

            case 'get_screen': {
                if (!emulator.isRomLoaded()) {
                    return {
                        content: [{ type: 'text', text: 'Error: No ROM loaded' }],
                        isError: true,
                    };
                }
                emulator.doFrame();
                const screen = getScreen();
                return { content: [screen] };
            }

            case 'start_live_view': {
                if (!emulator.isRomLoaded()) {
                    return {
                        content: [{ type: 'text', text: 'Error: No ROM loaded. Load a ROM first.' }],
                        isError: true,
                    };
                }

                // Ensure HTTP server is running
                const baseUrl = startHttpServer();
                const streamUrl = `${baseUrl}/stream`;

                // Start the stream
                emulator.startStream();

                // Create UI resource with live stream
                const uiResource = createUIResource({
                    uri: `ui://gameboy-server/live-view`,
                    content: {
                        type: 'rawHtml',
                        htmlString: `
<!DOCTYPE html>
<html>
<head>
    <style>
        body {
            margin: 0;
            padding: 0;
            background: #1a1a2e;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100%;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        .container {
            text-align: center;
            padding: 16px;
        }
        .screen-wrapper {
            background: #16213e;
            border-radius: 12px;
            padding: 12px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            display: inline-block;
        }
        .screen {
            width: 320px;
            height: 288px;
            border-radius: 8px;
            image-rendering: pixelated;
            image-rendering: crisp-edges;
            background: #0f0f23;
        }
        .status {
            margin-top: 12px;
            color: #4ade80;
            font-size: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
        }
        .status-dot {
            width: 8px;
            height: 8px;
            background: #4ade80;
            border-radius: 50%;
            animation: pulse 1.5s ease-in-out infinite;
        }
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }
        .title {
            color: #e0e0e0;
            font-size: 14px;
            margin-bottom: 12px;
            font-weight: 500;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="title">🎮 GameBoy Live View</div>
        <div class="screen-wrapper">
            <img class="screen" src="${streamUrl}" alt="GameBoy Screen" />
        </div>
        <div class="status">
            <span class="status-dot"></span>
            <span>Live at ${STREAM_FPS} FPS</span>
        </div>
    </div>
</body>
</html>
                        `.trim(),
                    },
                    encoding: 'text',
                    metadata: {
                        title: 'GameBoy Live View',
                        preferredSize: { width: 380, height: 420 },
                    },
                });

                return {
                    content: [
                        uiResource,
                        {
                            type: 'text',
                            text: `Live view started! Stream URL: ${streamUrl}`,
                        },
                    ],
                };
            }

            case 'stop_live_view': {
                emulator.stopStream();
                return {
                    content: [{ type: 'text', text: 'Live view stopped.' }],
                };
            }

            case 'is_rom_loaded': {
                const result: TextContent = {
                    type: 'text',
                    text: JSON.stringify({
                        romLoaded: emulator.isRomLoaded(),
                        romPath: emulator.getRomPath() || null,
                        streamActive: emulator.isStreamActive(),
                        streamUrl: httpServer ? `http://localhost:${STREAM_PORT}/stream` : null,
                    }),
                };
                return { content: [result] };
            }

            case 'list_roms': {
                const result = listRoms();
                return { content: [result] };
            }

            default:
                return {
                    content: [{ type: 'text', text: `Unknown tool: ${name}` }],
                    isError: true,
                };
        }
    } catch (error: any) {
        return {
            content: [{ type: 'text', text: `Error: ${error.message}` }],
            isError: true,
        };
    }
});

// --- Start Server ---
async function runServer() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('GameBoy MCP Server running on stdio');
    console.error(`Stream server will start on port ${STREAM_PORT} when ROM is loaded`);
}

runServer().catch((error) => {
    console.error('Server failed to start:', error);
    process.exit(1);
});
