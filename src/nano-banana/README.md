# Nano Banana MCP Server

A lean and powerful Model Context Protocol (MCP) server that exposes the raw capabilities of Google's **Gemini 2.5 Flash Image** model for image generation and editing. This server provides minimal, essential tools that allow LLMs to leverage the full power of the underlying AI model through natural language prompts.

## 🎯 Design Philosophy

The server provides access to Google's Gemini 2.5 Flash Image model capabilities:
- **Image Generation**: Create images from detailed text descriptions
- **Image Processing**: Any editing task through natural language instructions
- **Multi-Image Operations**: Combine and process multiple images together

## 🚀 Key Features

### Core Capabilities
- **Image Generation**: Create images from text prompts with various styles and aspect ratios
- **Image Editing**: Modify existing images based on natural language descriptions
- **Object Removal**: Remove unwanted objects while preserving the background
- **Background Changes**: Replace backgrounds while keeping subjects intact
- **Image Fusion**: Combine multiple images into creative compositions
- **Style Transfer**: Apply artistic styles to images

### Advanced Features
- **Character Consistency**: Maintain facial features and identities across edits
- **Scene Preservation**: Seamless blending with original lighting and composition
- **Multi-Image Processing**: Handle batch operations and complex compositions
- **Safety Features**: Built-in safety filters and provenance signals

## 🛠️ Installation

### Prerequisites
- Node.js 18.0.0 or higher
- Google AI API key (Gemini API access)

### Environment Setup

Set up your Google AI API key:

```bash
export GEMINI_API_KEY="your-api-key-here"
# or
export GOOGLE_GENERATIVE_AI_API_KEY="your-api-key-here"
```

### Usage in MCP Clients

The server can be used with any MCP-compatible client. The `-y` flag with npx automatically confirms package installation without user prompts, making it ideal for automated environments.

Here are some common configurations:

#### Claude Desktop
Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "nano-banana": {
      "command": "npx",
      "args": ["-y", "@truffle-ai/nano-banana-server"],
      "env": {
        "GEMINI_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

#### Dexto Framework
Add to your agent configuration:

```yaml
mcpServers:
  nano-banana:
    command: npx
    args:
      - -y
      - "@truffle-ai/nano-banana-server"
    env:
      GEMINI_API_KEY: "your-api-key-here"
```

#### Direct Usage
Run the server directly using npx:

```bash
npx -y @truffle-ai/nano-banana-server
```

The `-y` flag automatically confirms package installation without prompting.

### Development Setup

For development or local modifications:

```bash
# Clone the repository
git clone https://github.com/truffle-ai/mcp-servers.git
cd mcp-servers/src/nano-banana

# Install dependencies
npm install

# Build the server
npm run build

# Run in development mode
npm run dev
```

## 📋 Available Tools

The server provides 3 essential tools that expose the raw capabilities of Gemini 2.5 Flash Image:

### 1. `generate_image`
Generate new images from text prompts.

**Parameters:**
- `prompt` (required): Text description of the image to generate. Be specific about style, composition, lighting, and any other visual elements.
- `output_path` (optional): Output file path (auto-generated if not provided)

**Example:**
```json
{
  "prompt": "A majestic mountain landscape at sunset in realistic style with dramatic lighting and 16:9 aspect ratio"
}
```

### 2. `process_image`
Process existing images based on detailed instructions. This tool can handle any image editing task including object removal, background changes, style transfer, adding elements, and more. The key is to provide clear, specific instructions in the prompt.

**Parameters:**
- `image_path` (required): Path to the input image file
- `prompt` (required): Detailed instruction for what to do with the image
- `output_path` (optional): Output file path (auto-generated if not provided)

**Examples:**
```json
{
  "image_path": "/path/to/photo.jpg",
  "prompt": "Remove the red car in the background"
}
```

```json
{
  "image_path": "/path/to/portrait.jpg",
  "prompt": "Change the background to a beach sunset with palm trees"
}
```

```json
{
  "image_path": "/path/to/photo.jpg",
  "prompt": "Apply Van Gogh painting style with thick brushstrokes and vibrant colors"
}
```

### 3. `process_multiple_images`
Process multiple images together based on detailed instructions. This tool can combine images, create collages, blend compositions, or perform any multi-image operation. Provide clear instructions on how the images should be combined or processed.

**Parameters:**
- `image_paths` (required): Array of image file paths to process together (minimum 2)
- `prompt` (required): Detailed instruction for how to combine or process the images together
- `output_path` (optional): Output file path (auto-generated if not provided)

**Example:**
```json
{
  "image_paths": ["/path/to/person.jpg", "/path/to/landscape.jpg"],
  "prompt": "Place the person from the first image into the landscape from the second image, making sure they look natural in the scene with proper lighting and shadows"
}
```

## 🎨 Quick Start Examples

Here are some common use cases for the Nano Banana MCP Server:

### Image Generation
Create new images from text descriptions:
```json
{
  "tool": "generate_image",
  "arguments": {
    "prompt": "A futuristic cityscape at night with neon lights and flying cars, cyberpunk style"
  }
}
```

### Object Removal
Remove unwanted objects using the `process_image` tool:
```json
{
  "tool": "process_image",
  "arguments": {
    "image_path": "/path/to/photo.jpg",
    "prompt": "Remove the power lines and telephone poles from the background"
  }
}
```

### Background Changes
Change backgrounds using the `process_image` tool:
```json
{
  "tool": "process_image",
  "arguments": {
    "image_path": "/path/to/portrait.jpg",
    "prompt": "Change the background to a professional office setting with modern furniture"
  }
}
```

### Style Transfer
Apply artistic styles using the `process_image` tool:
```json
{
  "tool": "process_image",
  "arguments": {
    "image_path": "/path/to/photo.jpg",
    "prompt": "Apply Van Gogh painting style with thick brushstrokes and vibrant colors"
  }
}
```

### Figurine Effect
Create the signature figurine effect using the `process_image` tool:
```json
{
  "tool": "process_image",
  "arguments": {
    "image_path": "/path/to/photo.jpg",
    "prompt": "Transform this person into a mini figurine displayed on a desk"
  }
}
```

### Multi-Image Composition
Combine multiple images using the `process_multiple_images` tool:
```json
{
  "tool": "process_multiple_images",
  "arguments": {
    "image_paths": ["/path/to/person.jpg", "/path/to/landscape.jpg"],
    "prompt": "Place the person from the first image into the landscape from the second image, making sure they look natural in the scene"
  }
}
```

## 📁 Supported Formats

**Input/Output Formats:**
- JPEG (.jpg, .jpeg)
- PNG (.png)
- WebP (.webp)
- GIF (.gif)

**File Size Limits:**
- Maximum: 20MB per image
- Recommended: Under 10MB for optimal performance

## 🔧 Configuration

### Environment Variables
- `GEMINI_API_KEY` or `GOOGLE_GENERATIVE_AI_API_KEY`: Your Google AI API key

### Model Configuration
- **Model**: `gemini-2.5-flash-image-preview`
- **Max Image Size**: 20MB
- **Supported Formats**: JPG, PNG, WebP, GIF

## 🚀 Usage Examples

### Basic Image Generation
```bash
# Generate a landscape
{
  "tool": "generate_image",
  "arguments": {
    "prompt": "A serene lake surrounded by autumn trees",
    "style": "realistic",
    "aspect_ratio": "16:9"
  }
}
```

### Object Removal
```bash
# Remove unwanted objects
{
  "tool": "process_image",
  "arguments": {
    "image_path": "/path/to/photo.jpg",
    "prompt": "Remove the tourist in red shirt from the background"
  }
}
```

### Background Change
```bash
# Change background
{
  "tool": "process_image",
  "arguments": {
    "image_path": "/path/to/portrait.jpg",
    "prompt": "Change the background to a modern city skyline at night"
  }
}
```

### Style Transfer
```bash
# Apply artistic style
{
  "tool": "process_image",
  "arguments": {
    "image_path": "/path/to/photo.jpg",
    "prompt": "Apply watercolor painting style with soft edges and flowing colors"
  }
}
```

## 🎯 Popular Use Cases

### 1. **Selfie Enhancement**
- Remove blemishes and unwanted objects
- Change backgrounds for professional photos
- Apply artistic filters and styles
- Create figurine effects

### 2. **Product Photography**
- Remove backgrounds for clean product shots
- Add or remove objects from scenes
- Apply consistent styling across product images

### 3. **Creative Compositions**
- Fuse multiple images into unique scenes
- Apply artistic styles to photos
- Create imaginative scenarios from real photos

### 4. **Content Creation**
- Generate images for social media
- Create variations of existing content
- Apply brand-consistent styling

## 🔒 Safety & Ethics

Nano Banana includes built-in safety features:
- **SynthID Watermarks**: Invisible provenance signals
- **Safety Filters**: Content moderation and filtering
- **Character Consistency**: Maintains identity integrity
- **Responsible AI**: Designed to prevent misuse

## 🐛 Troubleshooting

### Common Issues

**API Key Error:**
```
Error: GEMINI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY environment variable is required
```
**Solution**: Set your Google AI API key as an environment variable.

**Unsupported Format:**
```
Error: Unsupported image format: .bmp
```
**Solution**: Convert your image to a supported format (JPG, PNG, WebP, GIF).

**File Too Large:**
```
Error: Image file too large: 25.5MB. Maximum size: 20MB
```
**Solution**: Compress or resize your image to under 20MB.

### Performance Tips
- Use images under 10MB for faster processing
- Compress images before processing
- Use appropriate aspect ratios for your use case
- Batch similar operations together

## 📚 API Reference

### Error Handling
The server returns structured error responses:
```json
{
  "content": [
    {
      "type": "text",
      "text": "Error: [error message]"
    }
  ],
  "isError": true
}
```

### Response Format
Successful operations return both image data and metadata:
```json
{
  "content": [
    {
      "type": "image",
      "data": "base64-encoded-image-data",
      "mimeType": "image/png"
    },
    {
      "type": "text",
      "text": "{\n  \"output_path\": \"/absolute/path/to/saved/image.png\",\n  \"size_bytes\": 12345,\n  \"format\": \"image/png\"\n}"
    }
  ]
}
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](../../CONTRIBUTING.md) for details.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](../../LICENSE) file for details.

## 🔗 Related Projects

- [Image Editor MCP Server](../image-editor/) - Traditional image editing tools
- [Gemini TTS MCP Server](../gemini-tts/) - Text-to-speech capabilities
- [Music Creator MCP Server](../music/) - AI music generation

## 📞 Support

For support and questions:
- Create an issue in the repository
- Check the troubleshooting section above
- Review the API documentation

---

**Note**: This MCP server provides a real implementation that integrates with Google's Generative AI API. It uses the `gemini-2.5-flash-image-preview` model and properly handles image generation and editing responses. The server returns both image content (base64-encoded) and text metadata according to MCP specifications, allowing clients to display images directly while providing detailed operation information.
