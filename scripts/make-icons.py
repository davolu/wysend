"""Rasterize the Wysend mark. The SVG source is public/icons/wysend.svg."""
import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "public" / "icons"
INK = (20, 53, 44, 255)
CREAM = (244, 239, 230, 255)
LIME = (214, 242, 92, 255)


def chunk(tag: bytes, data: bytes) -> bytes:
    return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)


def rounded(x: float, y: float, size: float, radius: float) -> bool:
    if x < radius:
        dx = radius - x
    elif x >= size - radius:
        dx = x - (size - radius - 1)
    else:
        dx = 0
    if y < radius:
        dy = radius - y
    elif y >= size - radius:
        dy = y - (size - radius - 1)
    else:
        dy = 0
    return dx * dx + dy * dy <= radius * radius


def lens(px: float, py: float, size: float) -> bool:
    cx, cy = size * 0.40, size * 0.50
    rx, ry = size * 0.22, size * 0.13
    nx, ny = (px - cx) / rx, (py - cy) / ry
    return nx * nx + ny * ny <= 1


def arrow(px: float, py: float, size: float) -> bool:
    # Right-pointing triangle overlapping the lens.
    x0, x1 = size * 0.52, size * 0.84
    if px < x0 or px > x1:
        return False
    t = (px - x0) / (x1 - x0)
    half = size * 0.16 * (1 - t)
    return abs(py - size * 0.50) <= half


def pupil(px: float, py: float, size: float, scale: float) -> bool:
    cx, cy = size * 0.36, size * 0.50
    r = size * scale
    dx, dy = px - cx, py - cy
    return dx * dx + dy * dy <= r * r


def paint(size: int) -> bytes:
    radius = size * 0.22
    raw = bytearray()
    for y in range(size):
        raw.append(0)
        for x in range(size):
            if not rounded(x + 0.5, y + 0.5, size, radius):
                raw.extend((0, 0, 0, 0))
                continue
            px, py = x + 0.5, y + 0.5
            if pupil(px, py, size, 0.055):
                raw.extend(INK)
            elif pupil(px, py, size, 0.095):
                raw.extend(LIME)
            elif lens(px, py, size) or arrow(px, py, size):
                raw.extend(CREAM)
            else:
                raw.extend(INK)
    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(bytes(raw), 9))
    png += chunk(b"IEND", b"")
    return png


def main() -> None:
    ROOT.mkdir(parents=True, exist_ok=True)
    for size in (16, 32, 48, 128):
        (ROOT / f"{size}.png").write_bytes(paint(size))
        print(f"wrote {size}.png")


if __name__ == "__main__":
    main()
