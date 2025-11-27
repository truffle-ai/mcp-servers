# @truffle-ai/gameboy-server

MCP server for GameBoy emulation - lets AI play GameBoy games like Pokemon.

## Installation

```bash
npm install -g @truffle-ai/gameboy-server
```

Or use directly with npx:

```bash
npx @truffle-ai/gameboy-server
```

## Configuration

Add to your MCP client configuration:

```json
{
  "mcpServers": {
    "gameboy": {
      "command": "npx",
      "args": ["-y", "@truffle-ai/gameboy-server"]
    }
  }
}
```

## Available Tools

### Button Controls

- `press_up` - Press the UP button
- `press_down` - Press the DOWN button
- `press_left` - Press the LEFT button
- `press_right` - Press the RIGHT button
- `press_a` - Press the A button
- `press_b` - Press the B button
- `press_start` - Press the START button
- `press_select` - Press the SELECT button

All button tools accept an optional `duration_frames` parameter (default: 25).

### Game Management

- `load_rom` - Load a GameBoy ROM file (.gb or .gbc)
- `get_screen` - Get the current screen (returns PNG image)
- `wait_frames` - Wait for specified frames without input
- `is_rom_loaded` - Check if a ROM is loaded
- `list_roms` - List ROM files in the `roms/` directory

## Usage Example

```
1. load_rom with rom_path: "/path/to/pokemon-red.gb"
2. press_start to start the game
3. get_screen to see current state
4. press_a to select options
5. Use directional buttons to navigate
```

## ROM Files

Place your ROM files (.gb or .gbc) in a `roms/` directory in your working directory, or provide absolute paths to `load_rom`.

**Note:** You must provide your own ROM files. This server does not include any games.

## License

MIT
