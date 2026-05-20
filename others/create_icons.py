from PIL import Image, ImageDraw
import os

def create_rounded_icon(src_path, dest_path, size, radius):
    img = Image.open(src_path).convert("RGBA")
    
    # Crop to square
    w, h = img.size
    min_dim = min(w, h)
    left = (w - min_dim)/2
    top = (h - min_dim)/2
    img = img.crop((left, top, left+min_dim, top+min_dim))
    
    # Resize
    img = img.resize((size, size), Image.Resampling.LANCZOS)
    
    # Create mask for rounded corners
    mask = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle((0, 0, size, size), radius=radius, fill=255)
    
    # Apply mask
    output = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    output.paste(img, (0, 0), mask)
    
    # Save
    os.makedirs(os.path.dirname(dest_path), exist_ok=True)
    output.save(dest_path, "PNG")

if __name__ == "__main__":
    src = "logo.jpeg"
    create_rounded_icon(src, "frontend/public/kuyu-icon-192.png", 192, 40)
    create_rounded_icon(src, "frontend/public/kuyu-icon-512.png", 512, 100)
    create_rounded_icon(src, "frontend/public/favicon.png", 64, 12)
    print("Icons generated successfully!")
