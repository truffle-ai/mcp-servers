# Image Editor MCP Server v2.0

A **lean and ultra-clean** Model Context Protocol (MCP) server for core image editing operations using OpenCV and Pillow.

## 🎯 Design Philosophy

This is a complete redesign focused on:
- **8 core tools** (down from 27+) 
- **~500 lines** (down from 1450+)
- **Clear decision tree** structure
- **Proper MCP error handling**
- **Zero over-engineering**

## 🛠️ Core Tools

### 1. Input/Info
- `load_image(path)` - Load and validate image, return metadata

### 2. Transform  
- `resize_image(path, width?, height?, keep_aspect=true)` - Resize with aspect ratio control
- `crop_image(path, x, y, width, height)` - Crop to rectangular region
- `convert_format(path, format, quality=90)` - Convert between formats

### 3. Enhance
- `adjust_image(path, brightness=0, contrast=1.0, saturation=1.0)` - Adjust image properties  
- `apply_filter(path, filter_type, intensity=1.0)` - Apply filters (blur, sharpen, grayscale, edge, sepia)

### 4. Annotate
- `add_annotation(path, type, ...)` - Unified tool for text, rectangles, circles, lines

### 5. Advanced
- `detect_objects(path, detection_type="faces")` - Computer vision detection
- `create_collage(image_paths, layout="grid")` - Simple collage creation

## 📋 Key Improvements

**From Bulky to Lean:**
- Consolidated 27 tools → 8 tools
- Removed redundant functionality  
- Single `add_annotation` handles all shapes/text
- Simple collage layouts only (grid/horizontal/vertical)

**Better Architecture:**
- Proper MCP error types (`McpError`, `ErrorCode`)
- Consistent parameter naming
- Smart defaults reduce cognitive load
- Clear tool categorization

**Decision Tree Structure:**
```
Need to work with images?
├── Load/validate → load_image()
├── Change size/format → resize_image(), crop_image(), convert_format()  
├── Enhance appearance → adjust_image(), apply_filter()
├── Add markup → add_annotation()
└── Advanced features → detect_objects(), create_collage()
```

## 🚀 Usage

**Image-producing tools** return `List[Any]` with MCP content blocks:
- `ImageContent`: Base64-encoded image data for immediate preview
- `TextContent`: JSON with `output_path` and `info` metadata

**Analysis tools** return `Dict[str, Any]` with structured data:
- `load_image()`: Image metadata (width, height, format, file size)
- `detect_objects()`: Detection results with counts and locations

Error handling uses proper MCP types:
- `JSONRPCError(INVALID_PARAMS, "message")` for bad input
- `JSONRPCError(INTERNAL_ERROR, "message")` for processing failures

## 📦 Dependencies

- **opencv-python** - Computer vision and core processing
- **pillow** - Image manipulation and format handling  
- **numpy** - Numerical operations
- **mcp** - Model Context Protocol SDK

## 🎨 Supported Formats

JPG, PNG, WebP, BMP, TIFF

## 🔍 Filters

- `blur` - Gaussian blur with adjustable intensity
- `sharpen` - Edge enhancement with intensity control
- `grayscale` - Convert to black & white
- `edge` - Edge detection using Canny algorithm
- `sepia` - Vintage sepia tone effect
- `emboss` - Embossed/raised effect
- `invert` - Color inversion
- `posterize` - Reduces color palette for poster-like effect

## 🚀 MCP Prompts (Quick Start!)

The server includes pre-built prompts for common tasks - perfect for first-time users:

### 🎭 **detect_faces_in_image**(image_path)
Quick face detection with just an image path
```
detect_faces_in_image("/path/to/photo.jpg")
```

### 📱 **resize_for_social_media**(image_path, platform="instagram") 
Resize images for social media with perfect dimensions
```
resize_for_social_media("/path/to/image.jpg", platform="twitter")
```

### 🎨 **apply_artistic_filter**(image_path, style="vintage")
Apply popular artistic effects (vintage, artistic, dramatic, soft)
```
apply_artistic_filter("/path/to/photo.jpg", style="dramatic")
```

### 🖼️ **create_photo_collage**(image_paths, layout_style="grid")
Create collages from multiple images
```
create_photo_collage("/img1.jpg, /img2.jpg, /img3.jpg", layout_style="horizontal")
```

### 🔄 **quick_format_conversion**(image_path, target_format="jpg")
Convert image formats with optimal quality
```
quick_format_conversion("/path/to/image.png", target_format="webp")
```

### 📊 **analyze_image_quickly**(image_path)
Get quick analysis and detect people in images
```
analyze_image_quickly("/path/to/photo.jpg")
```

**Usage**: These prompts provide user-facing instructions that guide the LLM/agent to accomplish tasks. All prompt parameters are optional with helpful fallback messages when not provided.

## 🧪 Testing

The server validates all inputs and provides clear error messages. Temporary files are auto-cleaned on exit.