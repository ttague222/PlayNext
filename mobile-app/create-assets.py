#!/usr/bin/env python3
"""Create placeholder assets for Expo app"""
import os
import struct
import zlib

def create_png(width, height, color, filename):
    """Create a simple solid-color PNG file"""
    def output_chunk(chunk_type, data):
        chunk_len = len(data)
        chunk = chunk_type + data
        checksum = zlib.crc32(chunk) & 0xffffffff
        return struct.pack('>I', chunk_len) + chunk + struct.pack('>I', checksum)

    # PNG signature
    signature = b'\x89PNG\r\n\x1a\n'

    # IHDR chunk
    ihdr_data = struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0)
    ihdr = output_chunk(b'IHDR', ihdr_data)

    # IDAT chunk (image data)
    raw_data = b''
    for y in range(height):
        raw_data += b'\x00'  # filter byte
        for x in range(width):
            raw_data += bytes(color)  # RGB

    compressed = zlib.compress(raw_data, 9)
    idat = output_chunk(b'IDAT', compressed)

    # IEND chunk
    iend = output_chunk(b'IEND', b'')

    # Write file
    with open(filename, 'wb') as f:
        f.write(signature + ihdr + idat + iend)

# Create assets directory
os.makedirs('assets/images', exist_ok=True)

# PlayNxt brand color (dark blue/purple gradient base)
brand_color = (26, 26, 46)  # #1a1a2e
accent_color = (233, 69, 96)  # #e94560

# Create icon.png (1024x1024)
print("Creating icon.png...")
create_png(1024, 1024, accent_color, 'assets/images/icon.png')

# Create splash.png (1284x2778 for iPhone)
print("Creating splash.png...")
create_png(1284, 2778, brand_color, 'assets/images/splash.png')

# Create adaptive-icon.png (1024x1024)
print("Creating adaptive-icon.png...")
create_png(1024, 1024, accent_color, 'assets/images/adaptive-icon.png')

# Create favicon.png (48x48)
print("Creating favicon.png...")
create_png(48, 48, accent_color, 'assets/images/favicon.png')

print("Done! Created placeholder assets.")
