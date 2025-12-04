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
import * as os from 'os';
import * as crypto from 'crypto';
import { createCanvas, Canvas } from 'canvas';
import { createRequire } from 'module';

// Use createRequire for CommonJS modules in ESM
const require = createRequire(import.meta.url);
// @ts-ignore - serverboy doesn't have types
const Gameboy = require('serverboy');

// --- Configuration ---
const STREAM_PORT = parseInt(process.env.GAMEBOY_STREAM_PORT || '3100', 10);
const STREAM_FPS = parseInt(process.env.GAMEBOY_STREAM_FPS || '15', 10);
const GAMEBOY_HOME = path.join(os.homedir(), '.gameboy-mcp');
const GAMES_DIR = path.join(GAMEBOY_HOME, 'games');

// --- Types ---
interface SaveStateMetadata {
    id: string;
    name: string;
    gameName: string;
    timestamp: string;
    screenshotBase64: string;
}

interface InstalledGame {
    name: string;
    romPath: string;
    savesDir: string;
    installedAt: string;
}

// --- Helper Functions ---
function ensureDir(dir: string): void {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

function generateId(): string {
    return crypto.randomBytes(4).toString('hex');
}

function sanitizeGameName(romPath: string): string {
    const basename = path.basename(romPath, path.extname(romPath));
    // Replace non-alphanumeric chars with dashes, lowercase
    return basename.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase().replace(/^-|-$/g, '');
}

function getGameDir(gameName: string): string {
    return path.join(GAMES_DIR, gameName);
}

function getSavesDir(gameName: string): string {
    return path.join(getGameDir(gameName), 'saves');
}

// Initialize directories on startup
ensureDir(GAMES_DIR);

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
    private gameName?: string;
    private streamActive: boolean = false;
    private streamClients: Set<(frame: Buffer) => void> = new Set();

    constructor() {
        this.gameboy = new Gameboy();
        this.canvas = createCanvas(160, 144);
    }

    // Install a ROM to the managed games directory
    installRom(sourcePath: string, customName?: string): InstalledGame {
        if (!fs.existsSync(sourcePath)) {
            throw new Error(`ROM file not found: ${sourcePath}`);
        }

        const gameName = customName || sanitizeGameName(sourcePath);
        const gameDir = getGameDir(gameName);
        const destRomPath = path.join(gameDir, 'rom' + path.extname(sourcePath));
        const savesDir = getSavesDir(gameName);

        // Create directories
        ensureDir(gameDir);
        ensureDir(savesDir);

        // Copy ROM if not already there or if source is newer
        if (!fs.existsSync(destRomPath) ||
            fs.statSync(sourcePath).mtime > fs.statSync(destRomPath).mtime) {
            fs.copyFileSync(sourcePath, destRomPath);
        }

        // Write metadata
        const metadataPath = path.join(gameDir, 'game.json');
        const metadata = {
            name: gameName,
            originalPath: sourcePath,
            installedAt: new Date().toISOString(),
        };
        fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

        return {
            name: gameName,
            romPath: destRomPath,
            savesDir,
            installedAt: metadata.installedAt,
        };
    }

    // Load ROM - installs if from external path, or loads directly if already installed
    loadRom(romPathOrGameName: string): void {
        let actualRomPath: string;
        let gameName: string;

        // Check if it's an installed game name
        const gameDir = getGameDir(romPathOrGameName);
        const potentialRomGb = path.join(gameDir, 'rom.gb');
        const potentialRomGbc = path.join(gameDir, 'rom.gbc');

        if (fs.existsSync(potentialRomGb)) {
            actualRomPath = potentialRomGb;
            gameName = romPathOrGameName;
        } else if (fs.existsSync(potentialRomGbc)) {
            actualRomPath = potentialRomGbc;
            gameName = romPathOrGameName;
        } else if (fs.existsSync(romPathOrGameName)) {
            // External ROM path - install it first
            const installed = this.installRom(romPathOrGameName);
            actualRomPath = installed.romPath;
            gameName = installed.name;
        } else {
            throw new Error(`ROM not found: ${romPathOrGameName}`);
        }

        const rom = fs.readFileSync(actualRomPath);
        this.gameboy.loadRom(rom);
        this.romLoaded = true;
        this.romPath = actualRomPath;
        this.gameName = gameName;
    }

    getGameName(): string | undefined {
        return this.gameName;
    }

    // Save current emulator state
    saveState(name?: string): SaveStateMetadata {
        if (!this.romLoaded || !this.gameName) {
            throw new Error('No ROM loaded');
        }

        const savesDir = getSavesDir(this.gameName);
        ensureDir(savesDir);

        const id = generateId();
        const stateName = name || `save-${id}`;
        const timestamp = new Date().toISOString();

        // Get the emulator state (this is a large array with all CPU/memory state)
        const state = this.gameboy.saveState();

        // Get a screenshot for the save state
        const screenshotBase64 = this.getScreenAsBase64();

        // Save state data
        const stateFile = path.join(savesDir, `${id}.state.json`);
        fs.writeFileSync(stateFile, JSON.stringify(state));

        // Save metadata
        const metadata: SaveStateMetadata = {
            id,
            name: stateName,
            gameName: this.gameName,
            timestamp,
            screenshotBase64,
        };
        const metadataFile = path.join(savesDir, `${id}.meta.json`);
        fs.writeFileSync(metadataFile, JSON.stringify(metadata, null, 2));

        return metadata;
    }

    // Load a saved state
    loadState(stateId: string): SaveStateMetadata {
        if (!this.romLoaded || !this.gameName) {
            throw new Error('No ROM loaded');
        }

        const savesDir = getSavesDir(this.gameName);
        const stateFile = path.join(savesDir, `${stateId}.state.json`);
        const metadataFile = path.join(savesDir, `${stateId}.meta.json`);

        if (!fs.existsSync(stateFile)) {
            throw new Error(`Save state not found: ${stateId}`);
        }

        const state = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
        const metadata: SaveStateMetadata = JSON.parse(fs.readFileSync(metadataFile, 'utf-8'));

        // Restore the emulator state
        this.gameboy.returnFromState(state);

        return metadata;
    }

    // List all save states for a game (defaults to current game)
    listStates(gameName?: string): SaveStateMetadata[] {
        const targetGame = gameName || this.gameName;
        if (!targetGame) {
            return [];
        }

        const savesDir = getSavesDir(targetGame);
        if (!fs.existsSync(savesDir)) {
            return [];
        }

        const metaFiles = fs.readdirSync(savesDir).filter(f => f.endsWith('.meta.json'));
        return metaFiles.map(f => {
            const content = fs.readFileSync(path.join(savesDir, f), 'utf-8');
            return JSON.parse(content) as SaveStateMetadata;
        }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }

    // Delete a save state
    deleteState(stateId: string, gameName?: string): boolean {
        const targetGame = gameName || this.gameName;
        if (!targetGame) {
            return false;
        }

        const savesDir = getSavesDir(targetGame);
        const stateFile = path.join(savesDir, `${stateId}.state.json`);
        const metadataFile = path.join(savesDir, `${stateId}.meta.json`);

        let deleted = false;
        if (fs.existsSync(stateFile)) {
            fs.unlinkSync(stateFile);
            deleted = true;
        }
        if (fs.existsSync(metadataFile)) {
            fs.unlinkSync(metadataFile);
            deleted = true;
        }
        return deleted;
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

function advanceFrames(count: number): void {
    for (let i = 0; i < count; i++) {
        emulator.doFrame();
    }
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

function listInstalledGames(): InstalledGame[] {
    if (!fs.existsSync(GAMES_DIR)) {
        return [];
    }
    const games: InstalledGame[] = [];
    const dirs = fs.readdirSync(GAMES_DIR);
    for (const dir of dirs) {
        const gameDir = path.join(GAMES_DIR, dir);
        const metadataFile = path.join(gameDir, 'game.json');
        const romGb = path.join(gameDir, 'rom.gb');
        const romGbc = path.join(gameDir, 'rom.gbc');

        if (fs.existsSync(metadataFile)) {
            const metadata = JSON.parse(fs.readFileSync(metadataFile, 'utf-8'));
            const romPath = fs.existsSync(romGb) ? romGb : romGbc;
            games.push({
                name: dir,
                romPath,
                savesDir: path.join(gameDir, 'saves'),
                installedAt: metadata.installedAt,
            });
        }
    }
    return games.sort((a, b) => new Date(b.installedAt).getTime() - new Date(a.installedAt).getTime());
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
        name: 'install_rom',
        description: 'Install a ROM to the managed games directory (~/.gameboy-mcp/games/). Does not load the ROM.',
        inputSchema: {
            type: 'object' as const,
            properties: {
                source_path: {
                    type: 'string',
                    description: 'Absolute path to the ROM file (e.g., ~/Downloads/pokemon.gb)',
                },
                name: {
                    type: 'string',
                    description: 'Custom name for the game (optional, defaults to sanitized filename)',
                },
            },
            required: ['source_path'],
        },
    },
    {
        name: 'load_rom',
        description: 'Load a GameBoy ROM. Accepts either a game name (from list_games) or an absolute path. If a path is provided, the ROM is automatically installed first.',
        inputSchema: {
            type: 'object' as const,
            properties: {
                game: {
                    type: 'string',
                    description: 'Game name (e.g., "pokemon-red") or absolute path to ROM file',
                },
            },
            required: ['game'],
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
        name: 'list_games',
        description: 'List all installed games in ~/.gameboy-mcp/games/',
        inputSchema: {
            type: 'object' as const,
            properties: {},
        },
    },
    // Save state tools
    {
        name: 'save_state',
        description: 'Save the current emulator state. Can be restored later with load_state.',
        inputSchema: {
            type: 'object' as const,
            properties: {
                name: {
                    type: 'string',
                    description: 'Optional name for the save state (e.g., "before-gym-battle")',
                },
            },
        },
    },
    {
        name: 'load_state',
        description: 'Load a previously saved state. Requires a ROM to be loaded first.',
        inputSchema: {
            type: 'object' as const,
            properties: {
                state_id: {
                    type: 'string',
                    description: 'The ID of the save state to load (from list_states)',
                },
            },
            required: ['state_id'],
        },
    },
    {
        name: 'list_states',
        description: 'List all save states for a game.',
        inputSchema: {
            type: 'object' as const,
            properties: {
                game_name: {
                    type: 'string',
                    description: 'Game name (optional, defaults to currently loaded game)',
                },
            },
        },
    },
    {
        name: 'delete_state',
        description: 'Delete a save state.',
        inputSchema: {
            type: 'object' as const,
            properties: {
                state_id: {
                    type: 'string',
                    description: 'The ID of the save state to delete',
                },
                game_name: {
                    type: 'string',
                    description: 'Game name (optional, defaults to currently loaded game)',
                },
            },
            required: ['state_id'],
        },
    },
];

// --- MCP Server Setup ---
const server = new Server(
    {
        name: 'gameboy-server',
        version: '0.3.0',
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

            case 'install_rom': {
                const sourcePath = (args as any)?.source_path;
                const customName = (args as any)?.name;
                if (!sourcePath) {
                    return {
                        content: [{ type: 'text', text: 'Error: source_path is required' }],
                        isError: true,
                    };
                }
                const installed = emulator.installRom(sourcePath, customName);
                return {
                    content: [{
                        type: 'text',
                        text: JSON.stringify({
                            message: `Installed game "${installed.name}"`,
                            ...installed,
                        }, null, 2),
                    }],
                };
            }

            case 'load_rom': {
                const game = (args as any)?.game;
                if (!game) {
                    return {
                        content: [{ type: 'text', text: 'Error: game is required' }],
                        isError: true,
                    };
                }
                emulator.loadRom(game);
                advanceFrames(5); // Initialize
                const screen = getScreen();

                // Also start HTTP server when ROM is loaded
                startHttpServer();

                return {
                    content: [
                        screen,
                        { type: 'text', text: `Loaded game: ${emulator.getGameName()}` },
                    ],
                };
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
                        gameName: emulator.getGameName() || null,
                        romPath: emulator.getRomPath() || null,
                        streamActive: emulator.isStreamActive(),
                        streamUrl: httpServer ? `http://localhost:${STREAM_PORT}/stream` : null,
                    }),
                };
                return { content: [result] };
            }

            case 'list_games': {
                const games = listInstalledGames();
                return {
                    content: [{
                        type: 'text',
                        text: games.length > 0
                            ? JSON.stringify(games, null, 2)
                            : 'No games installed. Use install_rom or load_rom with a path to install a game.',
                    }],
                };
            }

            case 'save_state': {
                if (!emulator.isRomLoaded()) {
                    return {
                        content: [{ type: 'text', text: 'Error: No ROM loaded' }],
                        isError: true,
                    };
                }
                const stateName = (args as any)?.name;
                const metadata = emulator.saveState(stateName);
                return {
                    content: [
                        {
                            type: 'image',
                            data: metadata.screenshotBase64,
                            mimeType: 'image/png',
                        },
                        {
                            type: 'text',
                            text: JSON.stringify({
                                message: `Saved state "${metadata.name}"`,
                                id: metadata.id,
                                name: metadata.name,
                                timestamp: metadata.timestamp,
                            }, null, 2),
                        },
                    ],
                };
            }

            case 'load_state': {
                if (!emulator.isRomLoaded()) {
                    return {
                        content: [{ type: 'text', text: 'Error: No ROM loaded. Load a ROM first.' }],
                        isError: true,
                    };
                }
                const stateId = (args as any)?.state_id;
                if (!stateId) {
                    return {
                        content: [{ type: 'text', text: 'Error: state_id is required' }],
                        isError: true,
                    };
                }
                const metadata = emulator.loadState(stateId);
                const screen = getScreen();
                return {
                    content: [
                        screen,
                        {
                            type: 'text',
                            text: `Loaded state "${metadata.name}" from ${metadata.timestamp}`,
                        },
                    ],
                };
            }

            case 'list_states': {
                const gameName = (args as any)?.game_name;
                const states = emulator.listStates(gameName);
                // Return without screenshots to keep response small
                const statesWithoutScreenshots = states.map(({ screenshotBase64, ...rest }) => rest);
                return {
                    content: [{
                        type: 'text',
                        text: states.length > 0
                            ? JSON.stringify(statesWithoutScreenshots, null, 2)
                            : 'No save states found.',
                    }],
                };
            }

            case 'delete_state': {
                const stateId = (args as any)?.state_id;
                const gameName = (args as any)?.game_name;
                if (!stateId) {
                    return {
                        content: [{ type: 'text', text: 'Error: state_id is required' }],
                        isError: true,
                    };
                }
                const deleted = emulator.deleteState(stateId, gameName);
                return {
                    content: [{
                        type: 'text',
                        text: deleted ? `Deleted save state ${stateId}` : `Save state ${stateId} not found`,
                    }],
                };
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
