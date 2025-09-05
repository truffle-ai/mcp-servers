# Music Creator MCP Server v2.0

A **lean and ultra-clean** Model Context Protocol (MCP) server for core music creation and audio processing operations.

## 🎯 Design Philosophy

This is a complete redesign focused on:
- **8 core tools** (down from 25+)
- **~650 lines** (down from 1179+)
- **Clear decision tree** structure
- **Proper MCP error handling**
- **Minimal dependencies**
- **Zero over-engineering**

## 🛠️ Core Tools

### 1. Input/Info
- `load_audio(path)` - Load and analyze audio/MIDI files, return metadata

### 2. Generate  
- `create_music(type="melody", key="C", duration=10, tempo=120, params={})` - Create melodies, chord progressions, harmonies
- `create_pattern(type="drums", style="rock", duration=8, tempo=120)` - Generate drum patterns and rhythms

### 3. Process
- `convert_audio(path, format, quality=90)` - Convert between audio formats (MP3, WAV, FLAC, OGG, M4A)
- `adjust_audio(path, volume=0, normalize=False, trim_start=0, trim_end=None)` - Volume, normalization, and trimming in one tool
- `apply_effect(path, effect_type, intensity=1.0, params={})` - Audio effects (reverb, echo, distortion, fades, reverse)

### 4. Analyze
- `analyze_music(path, analysis_type="basic")` - Tempo, key, and spectral analysis with type selection

### 5. Mix
- `mix_tracks(paths, volumes=[], output_format="wav")` - Mix multiple tracks with volume control

## 📋 Key Improvements

**From Bulky to Lean:**
- Consolidated 25+ tools → 8 tools
- Removed unnecessary dependencies (matplotlib, scipy, sklearn, pygame)
- Single `create_music()` handles melodies, chords, harmonies with type parameter
- One `adjust_audio()` tool vs 3 separate volume/normalize/trim tools
- Unified `analyze_music()` vs multiple analysis tools

**Better Architecture:**
- Proper MCP error types (`McpError`, `ErrorCode`)
- Consistent parameter naming and defaults
- No playback functionality (not suitable for MCP server environment)
- Smart music generation templates for common progressions and patterns
- Clear tool categorization

**Decision Tree Structure:**
```
Need to work with music/audio?
├── Load/validate → load_audio()
├── Create music → create_music(), create_pattern()  
├── Process audio → convert_audio(), adjust_audio(), apply_effect()
├── Analyze → analyze_music()
└── Mix → mix_tracks()
```

## 🚀 Usage

**All tools** return `Dict[str, Any]` with structured data:
- `output_path`: Path to generated/processed file
- `info`: File metadata (duration, format, size, etc.)
- Additional fields specific to each tool (tempo, key, effect_type, etc.)

Error handling uses proper MCP types:
- `JSONRPCError(INVALID_PARAMS, "message")` for bad input
- `JSONRPCError(INTERNAL_ERROR, "message")` for processing failures

## 🚀 Usage Examples

**Music Generation:**
```python
# Create a melody in G major
create_music(music_type="melody", key="G", duration=15, tempo=140, params={"scale": "major"})

# Create pop chord progression  
create_music(music_type="chords", key="C", duration=12, params={"progression": "pop"})

# Create rock drum pattern
create_pattern(pattern_type="drums", style="rock", duration=8, tempo=120)
```

**Audio Processing:**
```python
# Convert and adjust in sequence
convert_audio("song.mp3", format="wav")
adjust_audio("song.wav", volume=3, normalize=True, trim_start=10, trim_end=60)
apply_effect("song.wav", effect_type="reverb", intensity=2.0)
```

**Music Analysis:**
```python
# Basic analysis (tempo + key)
analyze_music("track.wav", analysis_type="basic")

# Detailed spectral analysis  
analyze_music("track.wav", analysis_type="spectral")
```

**Multi-track Mixing:**
```python
# Mix vocals, guitar, and drums
mix_tracks(["vocals.wav", "guitar.wav", "drums.wav"], volumes=[3, -2, 0], output_format="mp3")

# Mix MIDI melody with audio drum loop
mix_tracks(["melody.mid", "drums.wav"], volumes=[0, -5])
```

## 📦 Dependencies (Lean!)

- **librosa** - Audio analysis and music information retrieval
- **pydub** - Audio file manipulation and processing  
- **music21** - Music notation and generation
- **pretty_midi** - MIDI file handling
- **numpy** - Numerical operations
- **mcp** - Model Context Protocol SDK

**Removed Dependencies:** matplotlib, scipy, sklearn, pygame, soundfile, audioread, resampy

## 🎵 Supported Features

### Music Generation
- **Melodies** - Any key/scale with random note generation
- **Chord Progressions** - Pop, rock, jazz, folk, blues templates or custom progressions
- **Drum Patterns** - Rock, funk, jazz styles with realistic timing

### Audio Formats
- **Input/Output**: MP3, WAV, FLAC, OGG, M4A, AIFF
- **MIDI**: MID, MIDI files with audio conversion

### Audio Effects  
- **reverb** - Add spatial depth
- **echo** - Delay-based effect
- **distortion** - Add harmonic distortion
- **fade_in/fade_out** - Smooth transitions
- **reverse** - Reverse audio playback

### Analysis Types
- **basic** - Tempo and key detection
- **tempo** - Detailed BPM and beat analysis  
- **key** - Musical key with confidence rating
- **spectral** - Frequency domain analysis

## 🏗️ Installation & Configuration

### Saiki Configuration
```yaml
mcpServers:
  music_creator:
    type: stdio
    command: uvx
    args:
      - truffle-ai-music-creator-mcp
```

### Claude Desktop Configuration  
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

## 🚀 MCP Prompts (Quick Start!)

The server includes pre-built prompts for common tasks - perfect for first-time users:

### 🎵 **create_catchy_melody**(key="C", mood="happy")
Create melodies with different moods and keys
```
create_catchy_melody(key="G", mood="energetic")
```

### 🎼 **generate_chord_progression**(genre="pop", key="C")
Generate chord progressions for popular music genres
```
generate_chord_progression(genre="jazz", key="Fm")
```

### 🥁 **make_drum_beat**(style="rock", tempo=120)
Create drum patterns for different music styles
```
make_drum_beat(style="funk", tempo=110)
```

### 🔍 **analyze_song_info**(audio_path, analysis_depth="basic")
Analyze audio files for tempo, key, and musical information
```
analyze_song_info("/path/to/song.mp3", analysis_depth="detailed")
```

### 🔄 **convert_midi_to_audio**(midi_path, audio_format="wav")
Convert MIDI files to audio format for playback
```
convert_midi_to_audio("/path/to/melody.mid", audio_format="mp3")
```

### 🎧 **quick_track_mixing**(audio_paths, mix_style="balanced")
Mix multiple audio tracks with smart volume balancing
```
quick_track_mixing("/vocals.wav, /guitar.wav, /drums.wav", mix_style="vocal_focus")
```

### 🎤 **create_simple_song**(key="G", genre="pop")
Create complete songs with melody, chords, and drums
```
create_simple_song(key="Am", genre="folk")
```

**Usage**: These prompts provide user-facing instructions that guide the LLM/agent to accomplish music creation tasks. All prompt parameters are optional with helpful fallback messages when not provided.

## 🧪 Testing

The server validates all inputs and provides clear error messages. Temporary files are auto-cleaned on exit.

### Development Testing
```bash
# Install and test
uv sync
uv run python main.py

# Test basic functionality
uv run python test_functions.py
```

## 🔧 Advanced Usage

### Custom Chord Progressions
```python
# Use custom Roman numeral notation
create_music(music_type="chords", key="Am", params={"progression": "i-iv-V-i"})

# Or use template names
create_music(music_type="chords", key="G", params={"progression": "jazz"})
```

### Effect Chaining
```python
# Apply multiple effects in sequence
apply_effect("guitar.wav", "distortion", intensity=0.8)
apply_effect("guitar_distortion.wav", "reverb", intensity=1.5)
```

### MIDI to Audio Workflow  
```python
# Generate MIDI, convert to audio, then mix
create_music(music_type="melody", key="F", output_path="melody.mid")
convert_audio("melody.mid", format="wav")  
mix_tracks(["melody.wav", "backing_track.mp3"])
```

The redesigned server is lean, fast, and focused on essential music operations while maintaining full creative capabilities.