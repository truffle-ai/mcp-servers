#!/usr/bin/env python3

"""
Image Editor MCP Server - Lean & Ultra-Clean Implementation
Core image processing operations using OpenCV and Pillow
"""

import base64
import json
import os
import io
import tempfile
import atexit
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Union, Any

import cv2
import numpy as np
from mcp.server.fastmcp import FastMCP
from mcp.types import JSONRPCError, INVALID_PARAMS, INTERNAL_ERROR, TextContent, ImageContent
from PIL import Image, ImageDraw, ImageFont, ImageEnhance

# Create MCP server
mcp = FastMCP("image-editor")

# Temp directory management
_temp_dir = tempfile.mkdtemp(prefix="image_editor_")
temp_dir = Path(_temp_dir)
atexit.register(lambda: __import__('shutil').rmtree(_temp_dir, ignore_errors=True))

# Supported formats and filters
SUPPORTED_FORMATS = {'.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.webp'}
FILTERS = {
    'blur': lambda img, intensity: cv2.GaussianBlur(img, (int(5 + intensity * 10) | 1, int(5 + intensity * 10) | 1), 0),
    'sharpen': lambda img, intensity: cv2.filter2D(img, -1, np.array([[-1,-1,-1],[-1,9,-1],[-1,-1,-1]]) * intensity),
    'grayscale': lambda img, _: cv2.cvtColor(cv2.cvtColor(img, cv2.COLOR_BGR2GRAY), cv2.COLOR_GRAY2BGR),
    'edge': lambda img, _: cv2.cvtColor(cv2.Canny(cv2.cvtColor(img, cv2.COLOR_BGR2GRAY), 50, 150), cv2.COLOR_GRAY2BGR),
    'sepia': lambda img, _: cv2.transform(img, np.array([[0.393,0.769,0.189],[0.349,0.686,0.168],[0.272,0.534,0.131]])),
    'emboss': lambda img, intensity: cv2.filter2D(img, -1, np.array([[-2,-1,0],[-1,1,1],[0,1,2]]) * intensity),
    'invert': lambda img, _: cv2.bitwise_not(img),
    'posterize': lambda img, intensity: cv2.convertScaleAbs(img, alpha=1.0, beta=int(intensity * 50))
}


def _validate_path(path: str) -> str:
    """Validate image file path and format"""
    if not os.path.exists(path):
        raise JSONRPCError(INVALID_PARAMS, f"Image not found: {path}")
    
    ext = Path(path).suffix.lower()
    if ext not in SUPPORTED_FORMATS:
        raise JSONRPCError(INVALID_PARAMS, f"Unsupported format {ext}. Supported: {', '.join(SUPPORTED_FORMATS)}")
    
    return path

def _load_image(path: str) -> np.ndarray:
    """Load and validate image"""
    _validate_path(path)
    img = cv2.imread(path)
    if img is None:
        raise JSONRPCError(INTERNAL_ERROR, f"Failed to load image: {path}")
    return img

def _generate_output_path(input_path: str, suffix: str = "_processed", output_path: Optional[str] = None) -> str:
    """Generate output path if not provided"""
    if output_path:
        return output_path
    
    path = Path(input_path)
    return str(temp_dir / f"{path.stem}{suffix}{path.suffix}")

def _get_image_info(path: str) -> Dict[str, Any]:
    """Get image metadata"""
    img = _load_image(path)
    return {
        "path": path,
        "width": img.shape[1],
        "height": img.shape[0],
        "channels": img.shape[2] if len(img.shape) > 2 else 1,
        "size_bytes": os.path.getsize(path),
        "format": Path(path).suffix.lower()[1:]
    }

def _encode_image_data_uri(path: str) -> Tuple[str, str]:
    """Return (data_uri, mime_type) for an image file on disk"""
    ext = Path(path).suffix.lower()[1:]
    mime_subtype = {
        'jpg': 'jpeg',
        'jpeg': 'jpeg',
        'png': 'png',
        'webp': 'webp',
        'bmp': 'bmp',
        'tiff': 'tiff'
    }.get(ext, ext)
    with open(path, 'rb') as f:
        b64 = base64.b64encode(f.read()).decode('utf-8')
    data_uri = f"data:image/{mime_subtype};base64,{b64}"
    return data_uri, f"image/{mime_subtype}"

def _image_result(output_path: str) -> List[Any]:
    summary = {
        "output_path": output_path,
        "info": _get_image_info(output_path)
    }
    
    # Read image file and encode as base64
    with open(output_path, 'rb') as f:
        image_data = base64.b64encode(f.read()).decode('utf-8')
    
    # Determine MIME type from file extension
    ext = Path(output_path).suffix.lower()[1:]
    mime_type = f"image/{ext}" if ext in ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'tiff'] else "image/jpeg"
    if ext == 'jpg':
        mime_type = "image/jpeg"
    
    return [
        ImageContent(type='image', data=image_data, mimeType=mime_type),
        TextContent(type='text', text=json.dumps(summary))
    ]


@mcp.tool()
def load_image(path: str) -> Dict[str, Any]:
    """Load and validate an image file, returning detailed information
    
    Args:
        path: Absolute path to the image file
    
    Returns:
        Image metadata including dimensions, format, and file size
    """
    return _get_image_info(path)


@mcp.tool()
def resize_image(
    path: str,
    width: Optional[int] = None, 
    height: Optional[int] = None,
    keep_aspect: bool = True,
    output_path: Optional[str] = None
) -> List[Any]:
    """Resize an image to specified dimensions
    
    Args:
        path: Path to input image
        width: Target width in pixels
        height: Target height in pixels  
        keep_aspect: Whether to maintain aspect ratio (default: True)
        output_path: Path for output image (auto-generated if not provided)
    
    Returns:
        Information about the resized image
    """
    img = _load_image(path)
    output = _generate_output_path(path, "_resized", output_path)
    
    with Image.open(path) as pil_img:
        if width and height:
            if keep_aspect:
                pil_img.thumbnail((width, height), Image.Resampling.LANCZOS)
            else:
                pil_img = pil_img.resize((width, height), Image.Resampling.LANCZOS)
        elif width:
            ratio = width / pil_img.width
            new_height = int(pil_img.height * ratio)
            pil_img = pil_img.resize((width, new_height), Image.Resampling.LANCZOS)
        elif height:
            ratio = height / pil_img.height  
            new_width = int(pil_img.width * ratio)
            pil_img = pil_img.resize((new_width, height), Image.Resampling.LANCZOS)
        else:
            raise JSONRPCError(INVALID_PARAMS, "Must specify width or height")
            
        pil_img.save(output, quality=95)
    
    return _image_result(output)


@mcp.tool()
def crop_image(
    path: str,
    x: int,
    y: int, 
    width: int,
    height: int,
    output_path: Optional[str] = None
) -> List[Any]:
    """Crop an image to specified rectangular region
    
    Args:
        path: Path to input image
        x: Left edge of crop region
        y: Top edge of crop region  
        width: Width of crop region
        height: Height of crop region
        output_path: Path for output image
        
    Returns:
        Information about the cropped image
    """
    img = _load_image(path)
    
    if x < 0 or y < 0 or x + width > img.shape[1] or y + height > img.shape[0]:
        raise JSONRPCError(INVALID_PARAMS, "Crop region exceeds image boundaries")
    
    output = _generate_output_path(path, "_cropped", output_path)
    cropped = img[y:y+height, x:x+width]
    cv2.imwrite(output, cropped)
    
    return _image_result(output)


@mcp.tool()
def convert_format(
    path: str,
    format: str,
    quality: int = 90,
    output_path: Optional[str] = None
) -> List[Any]:
    """Convert image to different format
    
    Args:
        path: Path to input image
        format: Target format (jpg, png, webp, bmp, tiff)
        quality: Quality for lossy formats (1-100)
        output_path: Path for output image
        
    Returns:
        Information about the converted image
    """
    _load_image(path)  # Validate input
    
    if format.lower() not in ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'tiff']:
        raise JSONRPCError(INVALID_PARAMS, f"Unsupported output format: {format}")
        
    if not 1 <= quality <= 100:
        raise JSONRPCError(INVALID_PARAMS, "Quality must be 1-100")
    
    if not output_path:
        stem = Path(path).stem
        output_path = str(temp_dir / f"{stem}.{format}")
    
    with Image.open(path) as img:
        if img.mode != 'RGB' and format.lower() in ['jpg', 'jpeg']:
            img = img.convert('RGB')
            
        if format.lower() in ['jpg', 'jpeg', 'webp']:
            img.save(output_path, format.upper(), quality=quality)
        else:
            img.save(output_path, format.upper())
    
    return _image_result(output_path)


@mcp.tool()
def adjust_image(
    path: str,
    brightness: float = 0.0,
    contrast: float = 1.0, 
    saturation: float = 1.0,
    output_path: Optional[str] = None
) -> List[Any]:
    """Adjust image brightness, contrast, and saturation
    
    Args:
        path: Path to input image
        brightness: Brightness adjustment (-100 to 100)
        contrast: Contrast multiplier (0.1 to 3.0)
        saturation: Saturation multiplier (0.0 to 2.0)
        output_path: Path for output image
        
    Returns:
        Information about the adjusted image
    """
    _load_image(path)  # Validate input
    
    if not -100 <= brightness <= 100:
        raise JSONRPCError(INVALID_PARAMS, "Brightness must be -100 to 100")
    if not 0.1 <= contrast <= 3.0:
        raise JSONRPCError(INVALID_PARAMS, "Contrast must be 0.1 to 3.0")
    if not 0.0 <= saturation <= 2.0:
        raise JSONRPCError(INVALID_PARAMS, "Saturation must be 0.0 to 2.0")
    
    output = _generate_output_path(path, "_adjusted", output_path)
    
    with Image.open(path) as img:
        # Apply adjustments
        if brightness != 0:
            enhancer = ImageEnhance.Brightness(img)
            img = enhancer.enhance(1 + brightness / 100)
        
        if contrast != 1.0:
            enhancer = ImageEnhance.Contrast(img)
            img = enhancer.enhance(contrast)
            
        if saturation != 1.0:
            enhancer = ImageEnhance.Color(img)
            img = enhancer.enhance(saturation)
            
        img.save(output, quality=95)
    
    return _image_result(output)


@mcp.tool()
def apply_filter(
    path: str,
    filter_type: str,
    intensity: float = 1.0,
    output_path: Optional[str] = None
) -> List[Any]:
    """Apply image filters and effects
    
    Args:
        path: Path to input image
        filter_type: Type of filter (blur, sharpen, grayscale, edge, sepia, emboss, invert, posterize)
        intensity: Filter intensity (0.1 to 5.0)
        output_path: Path for output image
        
    Returns:
        Information about the filtered image
    """
    img = _load_image(path)
    
    if filter_type not in FILTERS:
        raise JSONRPCError(INVALID_PARAMS, f"Unknown filter: {filter_type}. Available: {', '.join(FILTERS.keys())}")
    
    if not 0.1 <= intensity <= 5.0:
        raise JSONRPCError(INVALID_PARAMS, "Intensity must be 0.1 to 5.0")
    
    output = _generate_output_path(path, f"_{filter_type}", output_path)
    
    try:
        processed = FILTERS[filter_type](img, intensity)
        cv2.imwrite(output, processed)
    except Exception as e:
        raise JSONRPCError(INTERNAL_ERROR, f"Filter processing failed: {str(e)}")
    
    return _image_result(output)


@mcp.tool()
def add_annotation(
    path: str,
    annotation_type: str,
    text: Optional[str] = None,
    x: int = 0,
    y: int = 0,
    width: Optional[int] = None,
    height: Optional[int] = None,
    color: str = "#FF0000",
    font_size: int = 20,
    thickness: int = 2,
    output_path: Optional[str] = None
) -> List[Any]:
    """Add annotations (text, rectangle, circle, line) to an image
    
    Args:
        path: Path to input image
        annotation_type: Type of annotation (text, rectangle, circle, line)
        text: Text content (for text annotations)
        x: X coordinate
        y: Y coordinate 
        width: Width (for rectangle) or end X (for line)
        height: Height (for rectangle) or end Y (for line)
        color: Color in hex format
        font_size: Font size for text
        thickness: Line/border thickness
        output_path: Path for output image
        
    Returns:
        Information about the annotated image
    """
    img = _load_image(path)
    output = _generate_output_path(path, f"_{annotation_type}", output_path)
    
    # Parse color
    try:
        hex_color = color.lstrip('#')
        r, g, b = tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))
        bgr_color = (b, g, r)  # OpenCV uses BGR
    except:
        raise JSONRPCError(INVALID_PARAMS, "Invalid color format. Use #RRGGBB")
    
    if annotation_type == "text":
        if not text:
            raise JSONRPCError(INVALID_PARAMS, "Text content required for text annotation")
        cv2.putText(img, text, (x, y), cv2.FONT_HERSHEY_SIMPLEX, font_size/30, bgr_color, thickness)
    elif annotation_type == "rectangle":
        if not width or not height:
            raise JSONRPCError(INVALID_PARAMS, "Width and height required for rectangle")
        cv2.rectangle(img, (x, y), (x + width, y + height), bgr_color, thickness)
    elif annotation_type == "circle":
        radius = width or 50
        cv2.circle(img, (x, y), radius, bgr_color, thickness)
    elif annotation_type == "line":
        if width is None or height is None:
            raise JSONRPCError(INVALID_PARAMS, "Width (end_x) and height (end_y) required for line")
        cv2.line(img, (x, y), (width, height), bgr_color, thickness)
    else:
        raise JSONRPCError(INVALID_PARAMS, f"Unknown annotation type: {annotation_type}")
    
    cv2.imwrite(output, img)
    return _image_result(output)


@mcp.tool()
def detect_objects(
    path: str, 
    detection_type: str = "faces"
) -> Dict[str, Any]:
    """Detect objects in images using computer vision
    
    Args:
        path: Path to input image
        detection_type: Type of detection (faces, edges, contours)
        
    Returns:
        Detection results with counts and locations
    """
    img = _load_image(path)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    if detection_type == "faces":
        face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
        faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(20, 20))
        
        return {
            "type": "faces",
            "count": len(faces),
            "locations": [{"x": int(x), "y": int(y), "width": int(w), "height": int(h)} for x, y, w, h in faces]
        }
    
    elif detection_type == "edges":
        edges = cv2.Canny(gray, 50, 150)
        edge_count = cv2.countNonZero(edges)
        return {
            "type": "edges",
            "count": int(edge_count),
            "density": float(edge_count) / (img.shape[0] * img.shape[1])
        }
    
    elif detection_type == "contours":
        edges = cv2.Canny(gray, 50, 150)
        contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        areas = [cv2.contourArea(c) for c in contours]
        
        return {
            "type": "contours",
            "count": len(contours),
            "areas": areas,
            "largest_area": max(areas) if areas else 0
        }
    
    else:
        raise JSONRPCError(INVALID_PARAMS, f"Unknown detection type: {detection_type}")


@mcp.tool()
def create_collage(
    image_paths: List[str],
    layout: str = "grid", 
    spacing: int = 10,
    output_path: Optional[str] = None
) -> List[Any]:
    """Create a simple collage from multiple images
    
    Args:
        image_paths: List of image file paths (minimum 2)
        layout: Layout type (grid, horizontal, vertical)
        spacing: Spacing between images in pixels
        output_path: Path for output collage
        
    Returns:
        Information about the created collage
    """
    if len(image_paths) < 2:
        raise JSONRPCError(INVALID_PARAMS, "At least 2 images required for collage")
    
    # Load and validate all images
    images = []
    for path in image_paths:
        img = _load_image(path)
        with Image.open(path) as pil_img:
            pil_img = pil_img.convert('RGB')
            pil_img.thumbnail((400, 400), Image.Resampling.LANCZOS)
            images.append(pil_img.copy())
    
    if not output_path:
        output_path = str(temp_dir / f"collage_{len(images)}_images.jpg")
    
    # Calculate layout dimensions
    if layout == "horizontal":
        cols, rows = len(images), 1
    elif layout == "vertical":
        cols, rows = 1, len(images)
    else:  # grid
        cols = int(np.ceil(np.sqrt(len(images))))
        rows = int(np.ceil(len(images) / cols))
    
    # Calculate canvas size
    max_width = max(img.width for img in images)
    max_height = max(img.height for img in images)
    canvas_width = cols * max_width + (cols - 1) * spacing
    canvas_height = rows * max_height + (rows - 1) * spacing
    
    # Create collage
    canvas = Image.new('RGB', (canvas_width, canvas_height), 'white')
    
    for i, img in enumerate(images):
        if i >= cols * rows:
            break
        
        row = i // cols
        col = i % cols
        
        x = col * (max_width + spacing) + (max_width - img.width) // 2
        y = row * (max_height + spacing) + (max_height - img.height) // 2
        
        canvas.paste(img, (x, y))
    
    canvas.save(output_path, quality=95)
    
    # Create custom result with additional collage info
    summary = {
        "output_path": output_path,
        "info": _get_image_info(output_path),
        "layout": layout,
        "image_count": len(images)
    }
    
    # Read image file and encode as base64
    with open(output_path, 'rb') as f:
        image_data = base64.b64encode(f.read()).decode('utf-8')
    
    # Determine MIME type from file extension
    ext = Path(output_path).suffix.lower()[1:]
    mime_type = f"image/{ext}" if ext in ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'tiff'] else "image/jpeg"
    if ext == 'jpg':
        mime_type = "image/jpeg"
    
    return [
        ImageContent(type='image', data=image_data, mimeType=mime_type),
        TextContent(type='text', text=json.dumps(summary))
    ]


# MCP Prompts for easy first-time use
@mcp.prompt()
def detect_faces_in_image(image_path: str = "") -> str:
    """Quick face detection - finds all faces in an image
    
    Args:
        image_path: Path to the image file to analyze
    """
    if not image_path:
        return "Detect all faces in the provided image and draw green bounding boxes around each face. Return the annotated image."
    
    return f"""Detect all faces in this image: {image_path}

Draw green bounding boxes around each detected face and return the annotated image for preview."""

@mcp.prompt()
def resize_for_social_media(image_path: str = "", platform: str = "instagram") -> str:
    """Resize image for social media platforms
    
    Args:
        image_path: Path to the image to resize
        platform: Social media platform (instagram, facebook, twitter)
    """
    sizes = {
        "instagram": "1080x1080",
        "facebook": "1200x630", 
        "twitter": "1200x675"
    }
    size = sizes.get(platform.lower(), "1080x1080")
    width, height = map(int, size.split('x'))
    
    if not image_path:
        return "Resize the provided image for social media posting. Choose appropriate dimensions for the platform."
    
    return f"""Resize this image for {platform}: {image_path}

Create a perfect {platform} post image with the correct dimensions."""

@mcp.prompt() 
def apply_artistic_filter(image_path: str = "", style: str = "vintage") -> str:
    """Apply popular artistic filters to an image
    
    Args:
        image_path: Path to the image
        style: Filter style (vintage, artistic, dramatic, soft)
    """
    filter_map = {
        "vintage": "sepia",
        "artistic": "edge", 
        "dramatic": "sharpen",
        "soft": "blur"
    }
    filter_type = filter_map.get(style.lower(), "sepia")
    
    if not image_path:
        return "Apply an artistic filter to the provided image to create a stylized effect."
    
    return f"""Apply a {style} artistic filter to this image: {image_path}

Give the image a beautiful {style} look with appropriate artistic effects."""

@mcp.prompt()
def create_photo_collage(image_paths: str = "", layout_style: str = "grid") -> str:
    """Create a photo collage from multiple images
    
    Args:
        image_paths: Comma-separated list of image paths
        layout_style: Layout style (grid, horizontal, vertical)
    """
    paths_list = [p.strip() for p in image_paths.split(",")]
    
    if not image_paths:
        return "Create a photo collage from the provided images using an attractive layout."
    
    return f"""Create a photo collage with these images: {image_paths}

Arrange these {len(paths_list)} images in a beautiful {layout_style} layout."""

@mcp.prompt()
def quick_format_conversion(image_path: str = "", target_format: str = "jpg") -> str:
    """Convert image to different format with optimal quality
    
    Args:
        image_path: Path to the image to convert
        target_format: Target format (jpg, png, webp)
    """
    quality = 95 if target_format.lower() in ['jpg', 'jpeg', 'webp'] else 90
    
    if not image_path:
        return "Convert the provided image to the specified format with optimal quality settings."
    
    return f"""Convert this image to {target_format.upper()} format: {image_path}

Ensure optimal quality for the conversion."""

@mcp.prompt()
def analyze_image_quickly(image_path: str = "") -> str:
    """Get quick analysis and information about an image
    
    Args:
        image_path: Path to the image to analyze
    """
    if not image_path:
        return "Analyze the provided image and provide key information about its contents, dimensions, and any detected features."
    
    return f"""Analyze this image and provide key information: {image_path}

Get basic image info (dimensions, format, file size) and detect any faces or other features in the image."""


def main():
    """Entry point for the MCP server"""
    mcp.run()


if __name__ == "__main__":
    main()