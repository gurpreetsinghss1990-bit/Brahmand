"""
Image Processing Service
Handles image compression and resizing using Pillow
"""
import io
import base64
import logging
from PIL import Image

logger = logging.getLogger(__name__)

# Maximum dimension for profile photos
MAX_IMAGE_SIZE = 512
# JPEG quality for compression
JPEG_QUALITY = 85


def compress_base64_image(base64_string: str, max_size: int = MAX_IMAGE_SIZE, quality: int = JPEG_QUALITY) -> str:
    """
    Compress and resize a base64 encoded image.
    
    Args:
        base64_string: Base64 encoded image (with or without data URI prefix)
        max_size: Maximum width/height in pixels
        quality: JPEG compression quality (1-100)
    
    Returns:
        Compressed base64 encoded JPEG image with data URI prefix
    """
    try:
        # Remove data URI prefix if present
        if ',' in base64_string:
            base64_data = base64_string.split(',')[1]
        else:
            base64_data = base64_string
        
        # Decode base64 to bytes
        image_bytes = base64.b64decode(base64_data)
        
        # Open image with Pillow
        image = Image.open(io.BytesIO(image_bytes))
        
        # Convert to RGB if necessary (for PNG with transparency)
        if image.mode in ('RGBA', 'LA', 'P'):
            # Create white background
            background = Image.new('RGB', image.size, (255, 255, 255))
            if image.mode == 'P':
                image = image.convert('RGBA')
            if 'A' in image.mode:
                background.paste(image, mask=image.split()[-1])
                image = background
            else:
                image = image.convert('RGB')
        elif image.mode != 'RGB':
            image = image.convert('RGB')
        
        # Calculate new size maintaining aspect ratio
        width, height = image.size
        if width > max_size or height > max_size:
            if width > height:
                new_width = max_size
                new_height = int(height * (max_size / width))
            else:
                new_height = max_size
                new_width = int(width * (max_size / height))
            
            # Resize with high-quality resampling
            image = image.resize((new_width, new_height), Image.Resampling.LANCZOS)
            logger.info(f"Resized image from {width}x{height} to {new_width}x{new_height}")
        
        # Compress to JPEG
        output_buffer = io.BytesIO()
        image.save(output_buffer, format='JPEG', quality=quality, optimize=True)
        compressed_bytes = output_buffer.getvalue()
        
        # Encode back to base64
        compressed_base64 = base64.b64encode(compressed_bytes).decode('utf-8')
        
        original_size = len(base64_data)
        new_size = len(compressed_base64)
        logger.info(f"Compressed image: {original_size} -> {new_size} bytes ({100 * new_size // original_size}%)")
        
        return f"data:image/jpeg;base64,{compressed_base64}"
        
    except Exception as e:
        logger.error(f"Image compression failed: {e}")
        # Return original if compression fails
        return base64_string


def is_valid_image(base64_string: str) -> bool:
    """
    Check if a base64 string is a valid image.
    
    Args:
        base64_string: Base64 encoded image
    
    Returns:
        True if valid image, False otherwise
    """
    try:
        if ',' in base64_string:
            base64_data = base64_string.split(',')[1]
        else:
            base64_data = base64_string
        
        image_bytes = base64.b64decode(base64_data)
        image = Image.open(io.BytesIO(image_bytes))
        image.verify()
        return True
    except Exception:
        return False


def get_image_size(base64_string: str) -> tuple:
    """
    Get the dimensions of a base64 encoded image.
    
    Args:
        base64_string: Base64 encoded image
    
    Returns:
        Tuple of (width, height) or (0, 0) if invalid
    """
    try:
        if ',' in base64_string:
            base64_data = base64_string.split(',')[1]
        else:
            base64_data = base64_string
        
        image_bytes = base64.b64decode(base64_data)
        image = Image.open(io.BytesIO(image_bytes))
        return image.size
    except Exception:
        return (0, 0)
