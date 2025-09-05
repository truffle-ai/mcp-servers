#!/usr/bin/env python3

"""
Music Creator MCP Server v2.0 - Lean & Ultra-Clean Implementation
Core music creation and audio processing operations
"""

import os
import tempfile
import atexit
import base64
import json
from pathlib import Path
from typing import Dict, List, Optional, Any
import numpy as np

import librosa
import music21
import pretty_midi
from pydub import AudioSegment
from pydub.effects import normalize
from mcp.server.fastmcp import FastMCP
from mcp.types import JSONRPCError, INVALID_PARAMS, INTERNAL_ERROR, TextContent, AudioContent, ErrorData

# Create MCP server
mcp = FastMCP("music-creator")

def _raise_error(code: int, message: str):
    """Helper to raise MCP errors correctly"""
    if code == INVALID_PARAMS:
        raise ValueError(message)
    else:
        raise RuntimeError(message)

# Temp directory management
_temp_dir = tempfile.mkdtemp(prefix="music_creator_")
temp_dir = Path(_temp_dir)
atexit.register(lambda: __import__('shutil').rmtree(_temp_dir, ignore_errors=True))

# Supported formats
SUPPORTED_AUDIO_FORMATS = {'.mp3', '.wav', '.flac', '.ogg', '.m4a', '.aiff'}
SUPPORTED_MIDI_FORMATS = {'.mid', '.midi'}
ALL_FORMATS = SUPPORTED_AUDIO_FORMATS | SUPPORTED_MIDI_FORMATS

# Audio effects mapping
EFFECTS = {
    'reverb': lambda audio, intensity: audio.overlay(audio - 15, position=int(100 * intensity)),
    'echo': lambda audio, intensity: audio.overlay(audio - 20, position=int(500 * intensity)),
    'distortion': lambda audio, intensity: audio + (audio * intensity * 0.3),
    'fade_in': lambda audio, intensity: audio.fade_in(int(1000 * intensity)),
    'fade_out': lambda audio, intensity: audio.fade_out(int(1000 * intensity)),
    'reverse': lambda audio, intensity: audio.reverse()
}

# Music generation templates
CHORD_PROGRESSIONS = {
    'pop': 'I-V-vi-IV',
    'rock': 'I-IV-V-I', 
    'jazz': 'I-vi-ii-V',
    'folk': 'I-IV-I-V',
    'blues': 'I-I-I-I-IV-IV-I-I-V-IV-I-V'
}

DRUM_PATTERNS = {
    'rock': {'kick': [0, 2], 'snare': [1, 3], 'hihat': [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5]},
    'funk': {'kick': [0, 1.5], 'snare': [1, 3], 'hihat': [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3, 3.25, 3.5, 3.75]},
    'jazz': {'kick': [0, 2.5], 'snare': [1, 3], 'hihat': [0, 0.33, 0.67, 1, 1.33, 1.67, 2, 2.33, 2.67, 3, 3.33, 3.67]}
}


def _validate_path(path: str) -> str:
    """Validate file path and format"""
    if not os.path.exists(path):
        _raise_error(INVALID_PARAMS, f"File not found: {path}")
    
    ext = Path(path).suffix.lower()
    if ext not in ALL_FORMATS:
        _raise_error(INVALID_PARAMS, f"Unsupported format {ext}")
    
    return path

def _load_audio(path: str) -> AudioSegment:
    """Load audio file using pydub"""
    _validate_path(path)
    try:
        return AudioSegment.from_file(path)
    except Exception as e:
        _raise_error(INTERNAL_ERROR, f"Failed to load audio: {str(e)}")

def _generate_output_path(input_path: str, suffix: str = "_processed", output_path: Optional[str] = None, ext: str = None) -> str:
    """Generate output path if not provided"""
    if output_path:
        return output_path
    
    path = Path(input_path) if input_path else Path("output")
    extension = ext or path.suffix
    return str(temp_dir / f"{path.stem}{suffix}{extension}")

def _get_file_info(path: str) -> Dict[str, Any]:
    """Get file metadata"""
    _validate_path(path)
    
    ext = Path(path).suffix.lower()
    file_size = os.path.getsize(path)
    
    info = {
        "path": path,
        "size_bytes": file_size,
        "format": ext[1:],
        "filename": Path(path).name
    }
    
    if ext in SUPPORTED_AUDIO_FORMATS:
        try:
            audio = AudioSegment.from_file(path)
            info.update({
                "duration": len(audio) / 1000.0,
                "channels": audio.channels,
                "frame_rate": audio.frame_rate,
                "sample_width": audio.sample_width
            })
        except:
            # Fallback to librosa for audio info
            try:
                y, sr = librosa.load(path, sr=None)
                info.update({
                    "duration": len(y) / sr,
                    "channels": 1 if len(y.shape) == 1 else 2,
                    "frame_rate": sr,
                    "sample_width": 2
                })
            except Exception as e:
                _raise_error(INTERNAL_ERROR, f"Could not analyze audio: {str(e)}")
    
    elif ext in SUPPORTED_MIDI_FORMATS:
        try:
            midi_data = pretty_midi.PrettyMIDI(path)
            info.update({
                "duration": midi_data.get_end_time(),
                "tempo": midi_data.estimate_tempo() or 120.0,
                "instruments": [inst.name for inst in midi_data.instruments],
                "note_count": sum(len(inst.notes) for inst in midi_data.instruments)
            })
        except Exception as e:
            _raise_error(INTERNAL_ERROR, f"Could not analyze MIDI: {str(e)}")
    
    return info


def _audio_result(output_path: str, additional_info: Optional[Dict[str, Any]] = None) -> List[Any]:
    """Create MCP content blocks for audio files"""
    try:
        file_info = _get_file_info(output_path)
    except Exception:
        # Fallback info if file analysis fails
        file_info = {
            "path": output_path,
            "size_bytes": os.path.getsize(output_path),
            "format": Path(output_path).suffix.lower()[1:],
            "filename": Path(output_path).name
        }
    
    summary = {
        "output_path": output_path,
        "info": file_info
    }
    
    if additional_info:
        summary.update(additional_info)
    
    # Check if this is a MIDI file and convert to WAV for webui playback
    ext = Path(output_path).suffix.lower()[1:]
    if ext in ['mid', 'midi']:
        # Convert MIDI to WAV for webui playback
        wav_path = str(Path(output_path).with_suffix('.wav'))
        try:
            # Convert MIDI to audio using pretty_midi
            midi_data = pretty_midi.PrettyMIDI(output_path)
            audio_data = midi_data.synthesize(fs=44100)
            
            # Convert to pydub AudioSegment and export as WAV
            audio_data = (audio_data * 32767).astype(np.int16)  # Convert to 16-bit
            audio = AudioSegment(
                audio_data.tobytes(),
                frame_rate=44100,
                sample_width=2,
                channels=1
            )
            audio.export(wav_path, format='wav')
            
            # Use the WAV file for the audio content
            with open(wav_path, 'rb') as f:
                audio_data = base64.b64encode(f.read()).decode('utf-8')
            
            # Update summary to include both MIDI and WAV paths
            summary['midi_path'] = output_path
            summary['audio_path'] = wav_path
            summary['converted'] = True
            
            # Clean up the temporary WAV file
            os.unlink(wav_path)
            
            mime_type = 'audio/wav'
        except Exception as e:
            # If conversion fails, fall back to MIDI file
            with open(output_path, 'rb') as f:
                audio_data = base64.b64encode(f.read()).decode('utf-8')
            mime_type = 'audio/midi'
            summary['conversion_error'] = str(e)
    else:
        # For non-MIDI files, read directly
        with open(output_path, 'rb') as f:
            audio_data = base64.b64encode(f.read()).decode('utf-8')
        
        # Determine MIME type from file extension
        mime_type_map = {
            'mp3': 'audio/mpeg',
            'wav': 'audio/wav',
            'flac': 'audio/flac',
            'ogg': 'audio/ogg',
            'm4a': 'audio/mp4',
            'aiff': 'audio/aiff'
        }
        mime_type = mime_type_map.get(ext, 'audio/mpeg')
    
    return [
        AudioContent(type='audio', data=audio_data, mimeType=mime_type),
        TextContent(type='text', text=json.dumps(summary))
    ]


@mcp.tool()
def load_audio(path: str) -> Dict[str, Any]:
    """Load and analyze an audio or MIDI file, returning detailed information
    
    Args:
        path: Absolute path to the audio or MIDI file
    
    Returns:
        File metadata including duration, format, channels, etc.
    """
    return _get_file_info(path)


@mcp.tool()
def create_music(
    music_type: str = "melody",
    key: str = "C", 
    duration: float = 10.0,
    tempo: int = 120,
    params: Optional[Dict[str, Any]] = None,
    output_path: Optional[str] = None
) -> List[Any]:
    """Create music - melodies, chord progressions, or harmonies
    
    Args:
        music_type: Type of music (melody, chords, harmony)
        key: Musical key (C, D, E, F, G, A, B with # for sharps)
        duration: Duration in seconds
        tempo: Tempo in BPM
        params: Additional parameters (scale, progression, etc.)
        output_path: Path for output MIDI file
        
    Returns:
        Information about the created music file
    """
    if params is None:
        params = {}
    
    if not output_path:
        output_path = str(temp_dir / f"{music_type}_{key}_{tempo}bpm.mid")
    
    # Create a stream
    stream = music21.stream.Stream()
    stream.append(music21.tempo.MetronomeMark(number=tempo))
    
    try:
        if music_type == "melody":
            scale_type = params.get('scale', 'major')
            scale_obj = music21.scale.MajorScale(key) if scale_type == "major" else music21.scale.MinorScale(key)
            scale_notes = list(scale_obj.getPitches())
            
            # Create simple melody
            import random
            random.seed(params.get('seed', 42))
            
            current_time = 0.0
            while current_time < duration:
                note = random.choice(scale_notes)
                note_duration = random.choice([0.5, 1.0, 2.0])
                
                n = music21.note.Note(note)
                n.duration = music21.duration.Duration(note_duration)
                stream.append(n)
                current_time += note_duration
        
        elif music_type == "chords":
            progression = params.get('progression', 'pop')
            if progression in CHORD_PROGRESSIONS:
                chord_sequence = CHORD_PROGRESSIONS[progression]
            else:
                chord_sequence = progression
            
            scale_obj = music21.scale.MajorScale(key)
            chords = chord_sequence.split('-')
            
            roman_to_intervals = {
                'I': [0, 2, 4], 'ii': [1, 3, 5], 'iii': [2, 4, 6], 'IV': [3, 5, 0],
                'V': [4, 6, 1], 'vi': [5, 0, 2], 'vii': [6, 1, 3]
            }
            
            chord_duration = duration / len(chords)
            for i, chord_symbol in enumerate(chords):
                if chord_symbol in roman_to_intervals:
                    intervals = roman_to_intervals[chord_symbol]
                    chord_notes = [scale_obj.pitches[interval % 7] for interval in intervals]
                    
                    chord = music21.chord.Chord(chord_notes)
                    chord.duration = music21.duration.Duration(chord_duration)
                    stream.append(chord)
        
        else:
            raise JSONRPCError(INVALID_PARAMS, f"Unknown music type: {music_type}")
        
        # Write to MIDI file
        stream.write('midi', fp=output_path)
        
        return _audio_result(output_path, {
            "music_type": music_type,
            "key": key,
            "tempo": tempo,
            "duration": duration
        })
        
    except Exception as e:
        raise JSONRPCError(INTERNAL_ERROR, f"Failed to create music: {str(e)}")


@mcp.tool()
def create_pattern(
    pattern_type: str = "drums",
    style: str = "rock",
    duration: float = 8.0,
    tempo: int = 120,
    output_path: Optional[str] = None
) -> List[Any]:
    """Create rhythmic patterns - drum beats and percussion
    
    Args:
        pattern_type: Type of pattern (drums, percussion)
        style: Style of pattern (rock, funk, jazz)
        duration: Duration in seconds
        tempo: Tempo in BPM
        output_path: Path for output MIDI file
        
    Returns:
        Information about the created pattern file
    """
    if not output_path:
        output_path = str(temp_dir / f"pattern_{style}_{tempo}bpm.mid")
    
    if pattern_type != "drums":
        raise JSONRPCError(INVALID_PARAMS, "Only drum patterns are currently supported")
    
    if style not in DRUM_PATTERNS:
        raise JSONRPCError(INVALID_PARAMS, f"Unknown style: {style}. Available: {', '.join(DRUM_PATTERNS.keys())}")
    
    try:
        # Create a stream
        stream = music21.stream.Stream()
        stream.append(music21.tempo.MetronomeMark(number=tempo))
        
        # Create drum track
        drum_track = music21.stream.Part()
        drum_track.append(music21.instrument.Percussion())
        
        pattern = DRUM_PATTERNS[style]
        beats_per_measure = 4
        measures = max(1, int(duration / (60/tempo * beats_per_measure)))
        
        # Add drum hits for each measure
        for measure in range(measures):
            measure_offset = measure * beats_per_measure
            
            for drum_type, hits in pattern.items():
                for hit_time in hits:
                    if measure_offset + hit_time < duration:
                        # Map drum types to notes
                        if drum_type == "kick":
                            drum_note = music21.note.Note('C2')
                        elif drum_type == "snare":
                            drum_note = music21.note.Note('D2')
                        elif drum_type == "hihat":
                            drum_note = music21.note.Note('F#2')
                        else:
                            continue
                        
                        drum_note.duration = music21.duration.Duration(0.25)
                        drum_note.offset = measure_offset + hit_time
                        drum_track.append(drum_note)
        
        stream.append(drum_track)
        
        # Write to MIDI file
        stream.write('midi', fp=output_path)
        
        return _audio_result(output_path, {
            "pattern_type": pattern_type,
            "style": style,
            "tempo": tempo,
            "duration": duration
        })
        
    except Exception as e:
        raise JSONRPCError(INTERNAL_ERROR, f"Failed to create pattern: {str(e)}")


@mcp.tool()
def convert_audio(
    path: str,
    format: str,
    quality: int = 90,
    output_path: Optional[str] = None
) -> List[Any]:
    """Convert audio between different formats
    
    Args:
        path: Path to input audio/MIDI file
        format: Target format (mp3, wav, flac, ogg, m4a)
        quality: Quality for lossy formats (10-100)
        output_path: Path for output file
        
    Returns:
        Information about the converted file
    """
    _validate_path(path)
    
    if format.lower() not in ['mp3', 'wav', 'flac', 'ogg', 'm4a']:
        raise JSONRPCError(INVALID_PARAMS, f"Unsupported format: {format}")
    
    if not 10 <= quality <= 100:
        raise JSONRPCError(INVALID_PARAMS, "Quality must be 10-100")
    
    if not output_path:
        stem = Path(path).stem
        output_path = str(temp_dir / f"{stem}.{format}")
    
    try:
        # Handle MIDI conversion
        ext = Path(path).suffix.lower()
        if ext in SUPPORTED_MIDI_FORMATS:
            # Convert MIDI to audio first
            midi_data = pretty_midi.PrettyMIDI(path)
            audio_data = midi_data.synthesize(fs=44100)
            
            # Convert to pydub AudioSegment
            audio_data = (audio_data * 32767).astype(np.int16)  # Convert to 16-bit
            audio = AudioSegment(
                audio_data.tobytes(),
                frame_rate=44100,
                sample_width=2,
                channels=1
            )
        else:
            audio = _load_audio(path)
        
        # Export with format-specific options
        if format.lower() == 'mp3':
            audio.export(output_path, format='mp3', bitrate=f"{quality}k")
        elif format.lower() in ['wav', 'flac']:
            audio.export(output_path, format=format.lower())
        elif format.lower() == 'ogg':
            audio.export(output_path, format='ogg', bitrate=f"{quality}k")
        elif format.lower() == 'm4a':
            audio.export(output_path, format='m4a', bitrate=f"{quality}k")
        
        return _audio_result(output_path, {
            "original_format": ext[1:],
            "target_format": format,
            "quality": quality
        })
        
    except Exception as e:
        raise JSONRPCError(INTERNAL_ERROR, f"Format conversion failed: {str(e)}")


@mcp.tool()
def adjust_audio(
    path: str,
    volume: float = 0.0,
    normalize: bool = False,
    trim_start: float = 0.0,
    trim_end: Optional[float] = None,
    output_path: Optional[str] = None
) -> List[Any]:
    """Adjust audio properties - volume, normalization, and trimming
    
    Args:
        path: Path to input audio file
        volume: Volume adjustment in dB (-50 to 50)
        normalize: Whether to normalize audio levels
        trim_start: Start time for trimming in seconds
        trim_end: End time for trimming in seconds (None = no trim)
        output_path: Path for output file
        
    Returns:
        Information about the adjusted audio
    """
    audio = _load_audio(path)
    
    if not -50 <= volume <= 50:
        raise JSONRPCError(INVALID_PARAMS, "Volume must be -50 to 50 dB")
    
    if trim_start < 0:
        raise JSONRPCError(INVALID_PARAMS, "Trim start must be >= 0")
    
    output = _generate_output_path(path, "_adjusted", output_path)
    
    try:
        # Apply volume adjustment
        if volume != 0:
            audio = audio + volume
        
        # Apply trimming
        if trim_end is not None:
            if trim_end <= trim_start:
                raise JSONRPCError(INVALID_PARAMS, "Trim end must be > trim start")
            audio = audio[int(trim_start * 1000):int(trim_end * 1000)]
        elif trim_start > 0:
            audio = audio[int(trim_start * 1000):]
        
        # Apply normalization
        if normalize:
            audio = normalize(audio)
        
        # Export
        audio.export(output, format=Path(output).suffix[1:])
        
        return _audio_result(output, {
            "adjustments": {
                "volume": volume,
                "normalized": normalize,
                "trim_start": trim_start,
                "trim_end": trim_end
            }
        })
        
    except Exception as e:
        raise JSONRPCError(INTERNAL_ERROR, f"Audio adjustment failed: {str(e)}")


@mcp.tool()
def apply_effect(
    path: str,
    effect_type: str,
    intensity: float = 1.0,
    params: Optional[Dict[str, Any]] = None,
    output_path: Optional[str] = None
) -> List[Any]:
    """Apply audio effects to a file
    
    Args:
        path: Path to input audio file
        effect_type: Type of effect (reverb, echo, distortion, fade_in, fade_out, reverse)
        intensity: Effect intensity (0.1 to 5.0)
        params: Additional effect parameters
        output_path: Path for output file
        
    Returns:
        Information about the processed audio
    """
    audio = _load_audio(path)
    
    if effect_type not in EFFECTS:
        raise JSONRPCError(INVALID_PARAMS, f"Unknown effect: {effect_type}. Available: {', '.join(EFFECTS.keys())}")
    
    if not 0.1 <= intensity <= 5.0:
        raise JSONRPCError(INVALID_PARAMS, "Intensity must be 0.1 to 5.0")
    
    output = _generate_output_path(path, f"_{effect_type}", output_path)
    
    try:
        # Apply the effect
        processed_audio = EFFECTS[effect_type](audio, intensity)
        
        # Export
        processed_audio.export(output, format=Path(output).suffix[1:])
        
        return _audio_result(output, {
            "effect_type": effect_type,
            "intensity": intensity,
            "params": params or {}
        })
        
    except Exception as e:
        raise JSONRPCError(INTERNAL_ERROR, f"Effect processing failed: {str(e)}")


@mcp.tool()
def analyze_music(
    path: str,
    analysis_type: str = "basic"
) -> Dict[str, Any]:
    """Analyze music files for tempo, key, and other properties
    
    Args:
        path: Path to audio file
        analysis_type: Type of analysis (basic, tempo, key, spectral)
        
    Returns:
        Analysis results based on the requested type
    """
    _validate_path(path)
    
    # Only analyze audio files
    ext = Path(path).suffix.lower()
    if ext not in SUPPORTED_AUDIO_FORMATS:
        raise JSONRPCError(INVALID_PARAMS, "Can only analyze audio files, not MIDI")
    
    try:
        # Load audio with librosa for analysis
        y, sr = librosa.load(path, sr=None)
        duration = len(y) / sr
        
        result = {
            "filename": Path(path).name,
            "duration": round(duration, 2),
            "sample_rate": sr
        }
        
        if analysis_type in ["basic", "tempo"]:
            # Tempo detection
            tempo, beats = librosa.beat.beat_track(y=y, sr=sr)
            result.update({
                "tempo": round(tempo, 1),
                "bpm": round(tempo, 0),
                "beat_count": len(beats)
            })
        
        if analysis_type in ["basic", "key"]:
            # Key detection
            chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
            key_raw = np.argmax(np.mean(chroma, axis=1))
            key_names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
            result.update({
                "key": key_names[key_raw],
                "key_confidence": round(float(np.max(np.mean(chroma, axis=1))), 3)
            })
        
        if analysis_type == "spectral":
            # Spectral features
            spectral_centroids = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
            spectral_rolloff = librosa.feature.spectral_rolloff(y=y, sr=sr)[0]
            rms = librosa.feature.rms(y=y)[0]
            
            result.update({
                "spectral_centroid_mean": round(float(np.mean(spectral_centroids)), 1),
                "spectral_rolloff_mean": round(float(np.mean(spectral_rolloff)), 1),
                "rms_energy": round(float(np.mean(rms)), 4)
            })
        
        return result
        
    except Exception as e:
        raise JSONRPCError(INTERNAL_ERROR, f"Analysis failed: {str(e)}")


@mcp.tool()
def mix_tracks(
    paths: List[str],
    volumes: Optional[List[float]] = None,
    output_format: str = "wav",
    output_path: Optional[str] = None
) -> List[Any]:
    """Mix multiple audio tracks together with volume control
    
    Args:
        paths: List of paths to audio/MIDI files (minimum 2)
        volumes: List of volume adjustments in dB (None = 0dB for all)
        output_format: Output format (wav, mp3, flac)
        output_path: Path for output file
        
    Returns:
        Information about the mixed audio file
    """
    if len(paths) < 2:
        raise JSONRPCError(INVALID_PARAMS, "At least 2 files required for mixing")
    
    if volumes and len(volumes) != len(paths):
        raise JSONRPCError(INVALID_PARAMS, f"Volume list length ({len(volumes)}) must match paths length ({len(paths)})")
    
    if not volumes:
        volumes = [0.0] * len(paths)
    
    if not output_path:
        output_path = str(temp_dir / f"mixed_{len(paths)}_tracks.{output_format}")
    
    try:
        # Load and process all files
        mixed_audio = None
        
        for i, (path, volume) in enumerate(zip(paths, volumes)):
            _validate_path(path)
            
            # Handle MIDI files
            ext = Path(path).suffix.lower()
            if ext in SUPPORTED_MIDI_FORMATS:
                # Convert MIDI to audio
                midi_data = pretty_midi.PrettyMIDI(path)
                audio_data = midi_data.synthesize(fs=44100)
                audio_data = (audio_data * 32767).astype(np.int16)
                
                audio = AudioSegment(
                    audio_data.tobytes(),
                    frame_rate=44100,
                    sample_width=2,
                    channels=1
                )
            else:
                audio = _load_audio(path)
            
            # Apply volume adjustment
            if volume != 0:
                audio = audio + volume
            
            # Mix with previous audio
            if mixed_audio is None:
                mixed_audio = audio
            else:
                # Ensure same length by padding shorter audio
                max_length = max(len(mixed_audio), len(audio))
                mixed_audio = mixed_audio + AudioSegment.silent(duration=max_length - len(mixed_audio))
                audio = audio + AudioSegment.silent(duration=max_length - len(audio))
                
                # Overlay (mix)
                mixed_audio = mixed_audio.overlay(audio)
        
        # Export mixed audio
        mixed_audio.export(output_path, format=output_format)
        
        return _audio_result(output_path, {
            "input_files": [Path(p).name for p in paths],
            "volumes": volumes,
            "track_count": len(paths)
        })
        
    except Exception as e:
        raise JSONRPCError(INTERNAL_ERROR, f"Mixing failed: {str(e)}")


# MCP Prompts for easy first-time use
@mcp.prompt()
def create_catchy_melody(key: str = "C", mood: str = "happy") -> str:
    """Create a catchy melody in a popular key and tempo
    
    Args:
        key: Musical key (C, D, E, F, G, A, B, with # for sharps)
        mood: Mood of the melody (happy, sad, energetic, calm)
    """
    tempo_map = {
        "happy": 130,
        "energetic": 140, 
        "calm": 90,
        "sad": 80
    }
    scale_map = {
        "happy": "major",
        "energetic": "major",
        "calm": "major", 
        "sad": "minor"
    }
    
    tempo = tempo_map.get(mood.lower(), 120)
    scale = scale_map.get(mood.lower(), "major")
    
    return f"""Create a {mood} melody in {key} {scale}.

Generate a catchy {mood} melody with appropriate tempo and musical characteristics."""

@mcp.prompt()
def generate_chord_progression(genre: str = "pop", key: str = "C") -> str:
    """Generate chord progressions for popular music genres
    
    Args:
        genre: Music genre (pop, rock, jazz, folk, blues)
        key: Musical key for the progression
    """
    duration_map = {
        "pop": 12,
        "rock": 16,
        "jazz": 20,
        "folk": 12,
        "blues": 24
    }
    
    duration = duration_map.get(genre.lower(), 12)
    
    return f"""Create a {genre} chord progression in {key}.

Generate a classic {genre} chord progression with appropriate timing and musical structure."""

@mcp.prompt()
def make_drum_beat(style: str = "rock", tempo: int = 120) -> str:
    """Create drum patterns for different music styles
    
    Args:
        style: Drum style (rock, funk, jazz)
        tempo: Beats per minute
    """
    return f"""Create a {style} drum beat at {tempo} BPM.

Generate a solid {style} drum pattern with appropriate rhythm and timing."""

@mcp.prompt()
def analyze_song_info(audio_path: str = "", analysis_depth: str = "basic") -> str:
    """Analyze audio files for tempo, key, and musical information
    
    Args:
        audio_path: Path to the audio file
        analysis_depth: Analysis depth (basic, detailed, full)
    """
    analysis_types = {
        "basic": "basic",
        "detailed": "tempo", 
        "full": "spectral"
    }
    
    analysis_type = analysis_types.get(analysis_depth.lower(), "basic")
    
    if not audio_path:
        return "Analyze the provided audio file and extract musical information like tempo, key, and other characteristics."
    
    return f"""Analyze this audio file: {audio_path}

Extract musical details like tempo, key, and other characteristics from the audio."""

@mcp.prompt()
def convert_midi_to_audio(midi_path: str = "", audio_format: str = "wav") -> str:
    """Convert MIDI files to audio format for playback
    
    Args:
        midi_path: Path to the MIDI file
        audio_format: Target audio format (wav, mp3, flac)
    """
    quality = 95 if audio_format.lower() in ['mp3', 'ogg'] else 90
    
    if not midi_path:
        return "Convert the provided MIDI file to audio format for playback."
    
    return f"""Convert this MIDI file to {audio_format.upper()} audio: {midi_path}

Convert the MIDI to high-quality audio for playback."""

@mcp.prompt()
def quick_track_mixing(audio_paths: str = "", mix_style: str = "balanced") -> str:
    """Mix multiple audio tracks with smart volume balancing
    
    Args:
        audio_paths: Comma-separated list of audio file paths
        mix_style: Mixing style (balanced, vocal_focus, instrumental_focus)
    """
    paths_list = [p.strip() for p in audio_paths.split(",")]
    
    volume_presets = {
        "balanced": [0] * len(paths_list),
        "vocal_focus": [3] + [-2] * (len(paths_list) - 1),
        "instrumental_focus": [-2] + [1] * (len(paths_list) - 1)
    }
    
    volumes = volume_presets.get(mix_style.lower(), [0] * len(paths_list))
    
    if not audio_paths:
        return "Mix the provided audio tracks together with appropriate volume balancing."
    
    return f"""Mix these {len(paths_list)} tracks with {mix_style} style: {audio_paths}

Create a professional {mix_style} mix with appropriate volume balancing."""

@mcp.prompt()
def create_simple_song(key: str = "G", genre: str = "pop") -> str:
    """Create a complete simple song with melody, chords, and drums
    
    Args:
        key: Musical key for the song
        genre: Genre style (pop, rock, jazz, folk)
    """
    tempo_map = {
        "pop": 120,
        "rock": 130,
        "jazz": 110, 
        "folk": 100
    }
    
    tempo = tempo_map.get(genre.lower(), 120)
    
    return f"""Create a simple {genre} song in {key}.

Generate a complete song with melody, chords, and drums, then mix them together into a cohesive {genre} track."""


def main():
    """Entry point for the MCP server"""
    mcp.run()


if __name__ == "__main__":
    main()