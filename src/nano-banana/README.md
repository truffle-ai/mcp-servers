# Nano Banana MCP Server

A lean and powerful Model Context Protocol (MCP) server that exposes the raw capabilities of Google's **Gemini 2.5 Flash Image** model for image generation and editing. This server provides minimal, essential tools that allow LLMs to leverage the full power of the underlying AI model through natural language prompts.

## 🎯 Design Philosophy

This MCP server follows a **lean design principle**:
- **3 Essential Tools**: Only the most fundamental capabilities
- **Raw AI Power**: Exposes the full capabilities of Gemini 2.5 Flash Image
- **Natural Language**: All operations driven by detailed prompts
- **No Thin Wrappers**: Avoids redundant functions that just repackage the same capability
- **LLM-Friendly**: Designed for LLMs to leverage the underlying AI model directly

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

### Setup
1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Build the server**:
   ```bash
   npm run build
   ```

3. **Set up API key**:
   ```bash
   export GEMINI_API_KEY="your-api-key-here"
   # or
   export GOOGLE_GENERATIVE_AI_API_KEY="your-api-key-here"
   ```

## 📋 Available Tools

### 1. `generate_image`
Generate new images from text prompts.

**Parameters:**
- `prompt` (required): Text description of the image to generate
- `style` (optional): Artistic style (realistic, artistic, cartoon, vintage, etc.)
- `aspect_ratio` (optional): Aspect ratio (1:1, 16:9, 9:16, 4:3, 3:4)
- `output_path` (optional): Output file path

**Example:**
```json
{
  "prompt": "A majestic mountain landscape at sunset",
  "style": "realistic",
  "aspect_ratio": "16:9"
}
```

### 2. `edit_image`
Edit existing images based on text prompts.

**Parameters:**
- `image_path` (required): Path to the input image
- `prompt` (required): Description of desired edits
- `edit_type` (optional): Type of edit (modify, add, remove, style_change, background_change)
- `output_path` (optional): Output file path

**Example:**
```json
{
  "image_path": "/path/to/photo.jpg",
  "prompt": "Add a rainbow in the sky",
  "edit_type": "add"
}
```

### 3. `remove_object`
Remove specific objects from images.

**Parameters:**
- `image_path` (required): Path to the input image
- `object_description` (required): Description of object to remove
- `output_path` (optional): Output file path

**Example:**
```json
{
  "image_path": "/path/to/photo.jpg",
  "object_description": "red car in the background"
}
```

### 4. `change_background`
Change the background of an image.

**Parameters:**
- `image_path` (required): Path to the input image
- `background_prompt` (required): Description of new background
- `output_path` (optional): Output file path

**Example:**
```json
{
  "image_path": "/path/to/portrait.jpg",
  "background_prompt": "beach sunset with palm trees"
}
```

### 5. `fuse_images`
Combine multiple images into one.

**Parameters:**
- `image_paths` (required): Array of image file paths (minimum 2)
- `fusion_prompt` (required): Description of how to combine images
- `output_path` (optional): Output file path

**Example:**
```json
{
  "image_paths": ["/path/to/person.jpg", "/path/to/landscape.jpg"],
  "fusion_prompt": "Place the person in the landscape as if they were standing there"
}
```

### 6. `apply_style_transfer`
Apply artistic style transfer to images.

**Parameters:**
- `image_path` (required): Path to the input image
- `style_reference` (optional): Path to style reference image
- `style_description` (required): Description of desired style
- `output_path` (optional): Output file path

**Example:**
```json
{
  "image_path": "/path/to/photo.jpg",
  "style_description": "Van Gogh painting style with thick brushstrokes"
}
```

## 🎨 Quick Start Examples

Here are some common use cases for the Nano Banana MCP Server:

### Selfie Variations
Transform selfies into creative variations using the `edit_image` tool:
```json
{
  "tool": "edit_image",
  "arguments": {
    "image_path": "/path/to/selfie.jpg",
    "prompt": "Transform this into a fantasy character",
    "edit_type": "style_change"
  }
}
```

### Object Removal
Remove unwanted objects using the `remove_object` tool:
```json
{
  "tool": "remove_object",
  "arguments": {
    "image_path": "/path/to/photo.jpg",
    "object_description": "power lines and telephone poles"
  }
}
```

### Background Changes
Change backgrounds using the `change_background` tool:
```json
{
  "tool": "change_background",
  "arguments": {
    "image_path": "/path/to/portrait.jpg",
    "background_prompt": "professional office setting"
  }
}
```

### Figurine Effect
Create the signature figurine effect using the `edit_image` tool:
```json
{
  "tool": "edit_image",
  "arguments": {
    "image_path": "/path/to/photo.jpg",
    "prompt": "Transform this person into a mini figurine displayed on a desk"
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
  "tool": "remove_object",
  "arguments": {
    "image_path": "/path/to/photo.jpg",
    "object_description": "tourist in red shirt"
  }
}
```

### Background Change
```bash
# Change background
{
  "tool": "change_background",
  "arguments": {
    "image_path": "/path/to/portrait.jpg",
    "background_prompt": "modern city skyline at night"
  }
}
```

### Style Transfer
```bash
# Apply artistic style
{
  "tool": "apply_style_transfer",
  "arguments": {
    "image_path": "/path/to/photo.jpg",
    "style_description": "watercolor painting with soft edges"
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
