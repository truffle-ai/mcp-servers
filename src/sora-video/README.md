# Sora Video MCP Server

A powerful Model Context Protocol (MCP) server for OpenAI Sora video generation with comprehensive video management capabilities.

## Features

- **🎬 Video Generation**: Create videos from text prompts using OpenAI Sora
- **📊 Status Monitoring**: Check video generation progress and status
- **📹 Video Management**: List, download, and delete your videos
- **🎭 Video Remixing**: Create variations of existing videos with new prompts
- **📁 File Management**: Automatic download and organization of generated videos
- **🖼️ Reference Support**: Use images or videos as reference for generation

## Prerequisites

- Node.js 18+
- OpenAI API key with Sora access
- An MCP-compatible client (Claude, Cursor, VS Code, etc.)

## Installation

1. Install dependencies:
```bash
npm install
```

2. Build the project:
```bash
npm run build
```

3. Set your OpenAI API key:
```bash
export OPENAI_API_KEY="your-openai-api-key-here"
```

## Usage

### Available Tools

#### `create_video`
Generate a video from a text prompt.

**Parameters:**
- `prompt` (required): Text description of the video to generate
- `model` (optional): Model to use (default: "sora-2")
- `seconds` (optional): Video duration in seconds (default: "4")
- `size` (optional): Resolution as "widthxheight" (default: "720x1280")
- `input_reference` (optional): Path to reference image/video file
- `output_directory` (optional): Directory to save metadata

**Example:**
```json
{
  "prompt": "A calico cat playing a piano on stage",
  "model": "sora-2",
  "seconds": "8",
  "size": "1024x1808"
}
```

#### `get_video_status`
Check the status and progress of a video generation job.

**Parameters:**
- `video_id` (required): ID of the video to check

**Example:**
```json
{
  "video_id": "video_123"
}
```

#### `list_videos`
List all your video generation jobs with pagination.

**Parameters:**
- `limit` (optional): Number of videos to retrieve (default: 20)
- `after` (optional): Pagination cursor
- `order` (optional): Sort order "asc" or "desc" (default: "desc")

#### `save_video`
Automatically download and save a completed video to your computer.

**Parameters:**
- `video_id` (required): ID of the video to save
- `output_path` (optional): Directory to save to (defaults to ~/Downloads)
- `filename` (optional): Custom filename (defaults to video_id.mp4)

#### `remix_video`
Create a remix of an existing video with a new prompt.

**Parameters:**
- `video_id` (required): ID of the completed video to remix
- `prompt` (required): New text prompt for the remix

#### `delete_video`
Delete a video job and its assets.

**Parameters:**
- `video_id` (required): ID of the video to delete

### Typical Workflow

1. **Create a video** → Get back a `video_id`
2. **Check status** → Monitor progress
3. **Save when ready** → Auto-download the video file
4. **Clean up** → Delete old videos

## Supported Formats

### Video Sizes
- `720x1280` (9:16 vertical)
- `1280x720` (16:9 horizontal)
- `1024x1024` (1:1 square)
- `1024x1808` (9:16 vertical HD)
- `1808x1024` (16:9 horizontal HD)

### Durations
- `4` seconds
- `8` seconds
- `16` seconds
- `32` seconds

### Reference Files
- **Images**: JPG, JPEG, PNG, WebP
- **Videos**: MP4, MOV, AVI, WebM

## Error Handling

The server includes comprehensive error handling:
- Missing API key validation on startup
- API error responses with detailed messages
- File validation for reference inputs
- Graceful error returns in tool responses

## Development

### Project Structure
```
sora-video/
├── src/
│   └── index.ts       # Main server implementation
├── dist/              # Compiled JavaScript (generated)
├── package.json       # Dependencies and scripts
├── tsconfig.json      # TypeScript configuration
└── README.md          # This file
```

### Scripts
- `npm run dev` - Run in development mode with auto-reload
- `npm run build` - Compile TypeScript to JavaScript
- `npm start` - Run compiled JavaScript

## Environment Variables

- `OPENAI_API_KEY` (required) - Your OpenAI API key

## License

MIT

## Resources

- [Model Context Protocol Documentation](https://modelcontextprotocol.io/)
- [OpenAI Sora API Documentation](https://platform.openai.com/docs/api-reference/videos)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
