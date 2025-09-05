# Gemini TTS MCP Server

A Model Context Protocol (MCP) server for Google Gemini Text-to-Speech (TTS). This server provides high-quality speech generation capabilities for AI agents and applications with a simple, intuitive interface.

## Features

- **Single Speaker Generation**: Generate speech from text using 30+ prebuilt voices
- **Multi-Speaker Conversations**: Create conversations with different voices for each speaker
- **Natural Language Tone Control**: Apply tone instructions like "Say cheerfully:" or "Speak in a formal tone:"
- **WebUI Compatible**: Returns audio content that can be played directly in web interfaces
- **Rate Limit Handling**: Automatically returns dummy audio when encountering 429 rate limit errors
- **Clean Architecture**: Simple, maintainable code following MCP best practices

## Installation

```bash
npm install @truffle-ai/gemini-tts-server
```

## Setup

1. **Get a Gemini API Key**: 
   - Visit [Google AI Studio](https://aistudio.google.com/)
   - Create a new API key for Gemini

2. **Set Environment Variable**:
   ```bash
   export GEMINI_API_KEY="your-api-key-here"
   # or
   export GOOGLE_GENERATIVE_AI_API_KEY="your-api-key-here"
   ```

## Usage

### In Saiki Agent Configuration

```yaml
mcpServers:
  gemini_tts:
    type: stdio
    command: npx
    args:
      - -y
      - "@truffle-ai/gemini-tts-server"
    env:
      GEMINI_API_KEY: $GEMINI_API_KEY
    timeout: 60000
    connectionMode: strict
```

### Available Tools

#### 1. `generate_speech`
Generate single-speaker audio from text. Use this for monologues, announcements, or single-speaker content.

**Parameters:**
- `text` (required): Text to convert to speech
- `voice` (required): Voice to use (see available voices below)
- `tone` (optional): Natural language tone instruction
- `output_directory` (optional): Directory to save audio file

**Example:**
```json
{
  "text": "Welcome to our podcast!",
  "voice": "Kore",
  "tone": "Say cheerfully:",
  "output_directory": "./audio"
}
```

#### 2. `generate_conversation`
Generate multi-speaker conversation audio. Use this for dialogues, interviews, or any content with multiple speakers.

**Parameters:**
- `text` (required): Text with speaker labels
- `speakers` (required): Array of speaker configurations
- `output_directory` (optional): Directory to save audio file

**Example:**
```json
{
  "text": "Host: Welcome to our show! Guest: Thank you for having me.",
  "speakers": [
    {
      "name": "Host",
      "voice": "Zephyr"
    },
    {
      "name": "Guest", 
      "voice": "Puck"
    }
  ],
  "output_directory": "./audio"
}
```

#### 3. `list_voices`
Get a list of all available voices with their characteristics. Use this to choose the right voice for your content.

**Parameters:** None

## Available Voices

| Voice | Characteristics |
|-------|----------------|
| Zephyr | Bright |
| Puck | Upbeat |
| Charon | Informative |
| Kore | Firm |
| Fenrir | Excitable |
| Leda | Youthful |
| Orus | Firm |
| Aoede | Breezy |
| Callirrhoe | Easy-going |
| Autonoe | Bright |
| Enceladus | Breathy |
| Iapetus | Clear |
| Umbriel | Easy-going |
| Algieba | Smooth |
| Despina | Smooth |
| Erinome | Clear |
| Algenib | Gravelly |
| Rasalgethi | Informative |
| Laomedeia | Upbeat |
| Achernar | Soft |
| Alnilam | Firm |
| Schedar | Even |
| Gacrux | Mature |
| Pulcherrima | Forward |
| Achird | Friendly |
| Zubenelgenubi | Casual |
| Vindemiatrix | Gentle |
| Sadachbia | Lively |
| Sadaltager | Knowledgeable |
| Sulafat | Warm |

## Return Types

All tools return structured content that includes:

- **Text Content**: Summary information about the generated audio
- **Audio Content**: Base64-encoded WAV audio data that can be played directly in web interfaces

The server is designed to work seamlessly with MCP-compatible applications and web interfaces.

## Tone Control Examples

You can use natural language to control the tone of speech:

- `"Say cheerfully: Welcome to our show!"`
- `"Speak in a formal tone: Welcome to our meeting"`
- `"Use an excited voice: This is amazing news!"`
- `"Speak slowly and clearly: This is important information"`

## Development

### Building from Source

```bash
git clone https://github.com/truffle-ai/mcp-servers.git
cd mcp-servers/src/gemini-tts
npm install
npm run build
```

### Testing Locally

```bash
# Set your API key
export GEMINI_API_KEY="your-api-key-here"

# Run the server
npm run build
node dist/index.js
```

## Error Handling

The server provides clear error messages for common issues:

- **Missing API Key**: Ensure `GEMINI_API_KEY` or `GOOGLE_GENERATIVE_AI_API_KEY` is set
- **Invalid Voice**: Use one of the available voices from the list
- **Network Issues**: Check your internet connection and API key validity
- **File System Errors**: Ensure output directories are writable
- **Rate Limit (429)**: Automatically returns dummy audio when rate limits are exceeded

### Rate Limit Handling

When the Gemini API returns a 429 status code (rate limit exceeded), the server automatically:

1. **Generates dummy audio**: Creates a 2-second sine wave tone (440 Hz) as a fallback
2. **Saves the file**: Stores the dummy audio with a descriptive filename
3. **Returns structured response**: Provides both text notification and audio data

This ensures your application continues to function even when API rate limits are hit, providing a graceful degradation experience.

## License

MIT License - see LICENSE file for details.

## Contributing

Contributions are welcome! Please see the main repository for contribution guidelines. 