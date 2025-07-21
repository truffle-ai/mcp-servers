# Music Creator MCP Server

A comprehensive Model Context Protocol (MCP) server for music creation, editing, and audio processing using industry-standard Python libraries like librosa, pydub, and music21.

## Overview

This MCP server provides a complete suite of tools for music production, from basic audio editing to advanced music generation and analysis. It's designed to be used with MCP clients like Claude Desktop, Saiki, or any other MCP-compatible application.

## Features

### 🎵 Audio Analysis
- **Tempo Detection**: Automatically detect BPM and beat positions
- **Key Detection**: Identify musical key and mode
- **Spectral Analysis**: Analyze frequency spectrum, MFCC features, and audio characteristics
- **Comprehensive Analysis**: Get detailed audio information including duration, sample rate, and format

### 🎼 Music Generation
- **Melody Creation**: Generate melodies in any key and scale
- **Chord Progressions**: Create chord progressions using Roman numeral notation
- **Drum Patterns**: Generate drum patterns for rock, jazz, and funk styles
- **MIDI Export**: All generated music exports to MIDI format for further editing

### 🔊 Audio Processing
- **Format Conversion**: Convert between MP3, WAV, FLAC, OGG, M4A, AIFF, WMA
- **Volume Control**: Adjust audio levels with precise dB control
- **Audio Normalization**: Normalize audio to target levels
- **Audio Trimming**: Cut audio to specific time ranges
- **Audio Effects**: Apply reverb, echo, distortion, and filters

### 🎚️ Mixing & Arrangement
- **Audio Merging**: Combine multiple audio files with crossfade support
- **Multi-track Mixing**: Mix multiple audio tracks with individual volume control
- **Batch Processing**: Process multiple files with the same operation

## Installation & Usage

### As a Published Package (Recommended)

Once published to PyPI, you can run the server directly with:

```bash
uvx truffle-ai-music-creator-mcp
```

### Local Development

For local development and testing:

```bash
# Clone or navigate to this directory
cd /path/to/mcp-servers/src/music

# Install dependencies and run
uv run python main.py
```

### Testing with uvx

Test the server locally before publishing:

```bash
# From the music directory
uvx --from . music-creator-mcp
```

## MCP Client Configuration

### Saiki Configuration

Add to your `agent.yml`:

```yaml
mcpServers:
  music_creator:
    type: stdio
    command: uvx
    args:
      - truffle-ai-music-creator-mcp
    connectionMode: strict
```

### Claude Desktop Configuration

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "music-creator": {
      "command": "uvx",
      "args": ["truffle-ai-music-creator-mcp"]
    }
  }
}
```

## Available Tools

### Music Generation
- `create_melody` - Generate melodies in any key and scale
- `create_chord_progression` - Create chord progressions using Roman numerals
- `create_drum_pattern` - Generate drum patterns for different styles

### Audio Analysis
- `analyze_audio` - Comprehensive audio analysis
- `detect_tempo` - Detect BPM and beat positions
- `detect_key` - Identify musical key and mode
- `get_audio_info` - Get detailed audio file information
- `get_midi_info` - Get detailed MIDI file information

### Audio Processing
- `convert_audio_format` - Convert between audio formats
- `convert_midi_to_audio` - Convert MIDI files to audio
- `adjust_volume` - Adjust audio levels in dB
- `normalize_audio` - Normalize audio to target levels
- `trim_audio` - Cut audio to specific time ranges
- `apply_audio_effect` - Apply reverb, echo, distortion, filters

### Mixing & Arrangement
- `merge_audio_files` - Combine multiple audio files
- `mix_audio_files` - Mix tracks with individual volume control

### Playback
- `play_audio` - Play audio files with optional start time and duration
- `play_midi` - Play MIDI files with optional start time and duration

### Utility
- `list_available_effects` - List all audio effects
- `list_drum_patterns` - List available drum patterns

## Supported Formats

### Audio Formats
- **MP3**: Most common compressed format
- **WAV**: Uncompressed high-quality audio
- **FLAC**: Lossless compressed audio
- **OGG**: Open-source compressed format
- **M4A**: Apple's compressed format
- **AIFF**: Apple's uncompressed format
- **WMA**: Windows Media Audio

### MIDI Formats
- **MID**: Standard MIDI files
- **MIDI**: Alternative MIDI extension

## Example Usage

### Audio Analysis
```
"Analyze the tempo and key of my song.mp3"
"What's the BPM of this track?"
"What key is this song in?"
```

### Music Generation
```
"Create a melody in G major at 140 BPM for 15 seconds"
"Create a I-IV-V-I chord progression in D major"
"Create a basic rock drum pattern"
```

### Audio Processing
```
"Convert my song.wav to MP3 format"
"Increase the volume of my vocals by 3dB"
"Normalize my guitar track to -18dB"
"Trim my song from 30 seconds to 2 minutes"
```

### Audio Effects
```
"Add reverb to my guitar with 200ms reverb time"
"Add echo to my vocals with 500ms delay and 0.7 decay"
"Add some distortion to my bass track"
```

### Mixing & Playback
```
"Mix my vocals, guitar, and drums together with the vocals at +3dB"
"Mix a MIDI melody with an MP3 drum loop"
"Play my song.mp3 starting from 30 seconds for 10 seconds"
```

## Dependencies

### Core Libraries
- **librosa**: Audio analysis and music information retrieval
- **pydub**: Audio file manipulation and processing
- **music21**: Music notation and analysis
- **pretty_midi**: MIDI file handling
- **numpy**: Numerical computing
- **scipy**: Scientific computing
- **matplotlib**: Plotting and visualization

### Optional Dependencies
- **pygame**: For audio and MIDI playback
- **ffmpeg**: For enhanced audio format support (recommended)

## Development

### Local Testing

```bash
# Install dependencies
uv sync

# Run tests
uv run python test_functions.py

# Format code
uv run black main.py
uv run ruff check main.py
```

### Building and Publishing

```bash
# Build the package
uv build

# Publish to PyPI
uv publish

# Or publish to TestPyPI first
uv publish --repository testpypi
```

## Troubleshooting

### Common Issues

1. **FFmpeg warnings**: These can be safely ignored. The server includes fallback methods using librosa and soundfile.

2. **Large audio files**: Consider trimming or converting to smaller formats for faster processing.

3. **Memory usage**: Monitor system memory during heavy audio operations.

4. **pygame dependency**: Required for playback features. Install with: `uv add pygame`

### Performance Tips

- Install FFmpeg for optimal audio processing performance
- Use batch operations for multiple files
- Monitor system resources during heavy operations
- Consider using smaller audio formats for faster processing

## License

MIT License - see the main mcp-servers repository for full license details.

## Contributing

This MCP server is part of the Truffle AI MCP servers collection. For contributions, please refer to the main repository guidelines.