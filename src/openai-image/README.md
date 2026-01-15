# OpenAI Image MCP Server

A Model Context Protocol (MCP) server that provides access to OpenAI's image generation and editing capabilities.

## 🎯 Features

- **Image Generation**: Create images from text prompts with detailed control
- **Image Editing**: Edit existing images with masks and prompts
- **Flexible Sizing**: Three image sizes (256x256, 512x512, 1024x1024)
- **Batch Processing**: Generate multiple images in a single request (editing only)
- **Auto Save**: Automatically downloads and saves generated images

## 🚀 Installation

### Prerequisites
- Node.js 18.0.0 or higher
- OpenAI API key

### Environment Setup

Set up your OpenAI API key:

```bash
export OPENAI_API_KEY="your-api-key-here"
```

### Usage in MCP Clients

The server can be used with any MCP-compatible client.

#### Claude Desktop
Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "openai-image": {
      "command": "npx",
      "args": ["-y", "@truffle-ai/openai-image-server"],
      "env": {
        "OPENAI_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

#### Dexto Framework
Add to your agent configuration:

```yaml
mcpServers:
  openai-image:
    command: npx
    args:
      - -y
      - "@truffle-ai/openai-image-server"
    env:
      OPENAI_API_KEY: "your-api-key-here"
```

#### Direct Usage
Run the server directly using npx:

```bash
npx -y @truffle-ai/openai-image-server
```

### Development Setup

For development or local modifications:

```bash
# Navigate to the server directory
cd src/openai-image

# Install dependencies
npm install

# Build the server
npm run build

# Run in development mode
npm run dev
```

## 📋 Available Tools

### `generate_image`
Generate an image from a text prompt using OpenAI's image generation API.

**Parameters:**
- `prompt` (required): Text description of the image to generate. Be specific and detailed.
- `size` (optional): Image dimensions - `256x256`, `512x512`, or `1024x1024`. Default: `256x256`
- `output_path` (optional): Custom output file path (auto-generated if not provided)

**Examples:**

Basic generation (256x256):
```json
{
  "prompt": "A serene mountain landscape at sunset with a lake reflection"
}
```

High resolution (1024x1024):
```json
{
  "prompt": "A futuristic city with flying cars and neon lights",
  "size": "1024x1024"
}
```

Medium resolution (512x512):
```json
{
  "prompt": "An abstract geometric pattern in vibrant colors",
  "size": "512x512"
}
```

### `edit_image`
Edit an existing image using a mask and prompt. The transparent areas of the mask indicate where the image should be edited.

**Parameters:**
- `image_path` (required): Path to the input image file to edit (must be PNG, less than 4MB, and square)
- `mask_path` (optional): Path to the mask image file (must be PNG, same size as image, transparent areas indicate where to edit)
- `prompt` (required): Text description of the edit to make
- `size` (optional): Output image size - `256x256`, `512x512`, or `1024x1024`. Default: `1024x1024`
- `n` (optional): Number of images to generate (1-10). Default: `1`
- `output_path` (optional): Custom output file path (auto-generated if not provided)

**Examples:**

Edit with mask:
```json
{
  "image_path": "/path/to/room.png",
  "mask_path": "/path/to/mask.png",
  "prompt": "A sunlit potted plant on the table",
  "size": "1024x1024"
}
```

Edit without mask (edits entire image):
```json
{
  "image_path": "/path/to/photo.png",
  "prompt": "Add a sunset in the background"
}
```

Generate multiple variations:
```json
{
  "image_path": "/path/to/scene.png",
  "mask_path": "/path/to/mask.png",
  "prompt": "A red sports car",
  "n": 3
}
```

## 💡 Use Cases

### Content Creation
- Generate images for blog posts and articles
- Create social media graphics
- Design marketing materials
- Produce concept art

### Product Design
- Visualize product ideas
- Create mockups
- Generate design variations
- Explore different styles

### Creative Projects
- Artistic illustrations
- Story visualization
- Character design
- Environmental concepts

### Professional Applications
- Presentation graphics
- Report illustrations
- Educational materials
- Brand identity exploration

## 🔧 Configuration

### Environment Variables
- `OPENAI_API_KEY` (required): Your OpenAI API key

### Model Configuration
The server automatically handles:
- Image downloading from OpenAI
- Local file storage
- Base64 encoding for MCP responses
- Error handling and validation

## 📚 API Response Format

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
      "text": "{
  \"output_path\": \"/absolute/path/to/saved/image.png\",
  \"size_bytes\": 12345,
  \"format\": \"image/png\"
}"
    }
  ]
}
```

## 🐛 Troubleshooting

### Common Issues

**API Key Error:**
```
Error: OPENAI_API_KEY environment variable is required
```
**Solution**: Set your OpenAI API key as an environment variable.

### Performance Tips
- Use standard quality for faster generation
- Use HD quality for highest quality results
- Use specific, detailed prompts for best results
- Choose appropriate image sizes for your use case

## 📖 Best Practices

### Writing Effective Prompts
- Be specific about what you want
- Include details about style, lighting, and composition
- Mention specific artists or art styles if relevant
- Specify the mood or atmosphere
- Include technical details (camera angle, perspective, etc.)

### Example Good Prompts
- "A professional product photo of a smartwatch on a white background, soft lighting, studio photography"
- "An oil painting of a medieval castle on a hill at sunset, in the style of Bob Ross, warm colors, peaceful atmosphere"
- "A modern minimalist logo design for a tech company, geometric shapes, blue and white color scheme"

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](../../CONTRIBUTING.md) for details.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](../../LICENSE) file for details.

## 🔗 Related Projects

- [Nano Banana MCP Server](../nano-banana/) - Google Gemini image generation
- [Image Editor MCP Server](../image-editor/) - Traditional image editing tools

## 📞 Support

For support and questions:
- Create an issue in the repository
- Check the troubleshooting section above
- Review OpenAI's API documentation

## 📚 Additional Resources

- [OpenAI Image Generation API Guide](https://platform.openai.com/docs/guides/image-generation)
- [OpenAI Images API Reference](https://platform.openai.com/docs/api-reference/images)

---

**Note**: This server requires a valid OpenAI API key. Image generation costs are billed according to OpenAI's pricing. Check [OpenAI's pricing page](https://openai.com/pricing) for current rates.
