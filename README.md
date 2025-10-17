# mcp-servers
MCP servers built by Truffle AI team. Can be used with Dexto to create powerful AI Agents.

Similar to reference servers built here: https://github.com/modelcontextprotocol/servers

## Available Servers

### 🎵 Music Creator (`src/music/`)
A comprehensive music generation and audio processing MCP server with support for:
- Music generation (chords, melodies, patterns)
- Audio format conversion
- Audio effects and adjustments
- Multi-track mixing
- MIDI file support with automatic conversion to playable audio

### 🖼️ Image Editor (`src/image-editor/`)
A powerful image processing MCP server with OpenCV and PIL support:
- Image resizing, cropping, and format conversion
- Advanced filters and effects
- Face detection and annotation
- Image enhancement and adjustment
- Collage creation

### 🎙️ Gemini TTS (`src/gemini-tts/`)
A high-quality text-to-speech MCP server using Google Gemini TTS:
- Single and multi-speaker speech generation
- 30+ prebuilt voices with natural characteristics
- Natural language tone control
- Multi-language support (24+ languages)
- Rate limit handling with graceful fallbacks

### 🎬 Sora Video (`src/sora-video/`)
An advanced AI video generation MCP server powered by OpenAI Sora:
- Generate realistic videos from text prompts using Sora
- Flexible duration (4s, 8s, 16s, 32s)
- Multiple aspect ratios supported: vertical, horizontal, and square
- Reference-based generation using existing images or videos
- Progress monitoring and management of video creation jobs
- Organize and download generated video files

## Installation

Each server can be installed individually:

```bash
# Music Creator
npm install @truffle-ai/music-creator-server

# Image Editor  
npm install @truffle-ai/image-editor-server

# Gemini TTS
npm install @truffle-ai/gemini-tts-server
```

## Usage

See individual server README files for detailed usage instructions and configuration examples.
