"""Extract the original PNG's opaque contours for actual extruded 3D geometry.

Run with Python 3 + Pillow; the generated JSON is committed, so the web app
does not require Python or trace the image at runtime.
"""

import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]


def simplify(points, tolerance=0.7):
    if len(points) <= 2:
        return points
    a, b = points[0], points[-1]
    dx, dy = b[0] - a[0], b[1] - a[1]
    length = dx * dx + dy * dy
    distances = []
    for x, y in points[1:-1]:
        t = max(0, min(1, ((x-a[0])*dx + (y-a[1])*dy) / length)) if length else 0
        distances.append((x-a[0]-t*dx)**2 + (y-a[1]-t*dy)**2)
    maximum = max(distances, default=0)
    if maximum <= tolerance * tolerance:
        return [a, b]
    split = distances.index(maximum) + 1
    return simplify(points[:split+1], tolerance)[:-1] + simplify(points[split:], tolerance)


def contours(pixels):
    edges = {}
    for x, y in sorted(pixels):
        # Clockwise boundary in image coordinates; holes have opposite winding.
        for neighbor, start, end in (
            ((x, y-1), (x, y), (x+1, y)),
            ((x+1, y), (x+1, y), (x+1, y+1)),
            ((x, y+1), (x+1, y+1), (x, y+1)),
            ((x-1, y), (x, y+1), (x, y)),
        ):
            if neighbor not in pixels:
                edges.setdefault(start, []).append(end)
    loops = []
    while edges:
        start = next(iter(edges))
        point = start
        loop = [start]
        while True:
            following = edges[point].pop()
            if not edges[point]:
                del edges[point]
            point = following
            loop.append(point)
            if point == start:
                break
        area = sum(a[0]*b[1]-b[0]*a[1] for a, b in zip(loop, loop[1:])) / 2
        if abs(area) > 3:
            # Split closed loops before RDP so the endpoints are distinct.
            half = len(loop) // 2
            reduced = simplify(loop[:half+1])[:-1] + simplify(loop[half:])[:-1]
            loops.append({'points': reduced, 'hole': area < 0})
    return loops


def main():
    im = Image.open(ROOT / 'RECAPP.png').convert('RGBA')
    groups = {'red': set(), 'white': set()}
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = im.getpixel((x, y))
            if a >= 128:
                groups['red' if r > g * 1.5 else 'white'].add((x, y))
    all_pixels = groups['red'] | groups['white']
    left = min(x for x, y in all_pixels)
    top = min(y for x, y in all_pixels)
    right = max(x for x, y in all_pixels) + 1
    bottom = max(y for x, y in all_pixels) + 1
    data = {'width': right-left, 'height': bottom-top, 'layers': []}
    for color, pixels in groups.items():
        loops = contours(pixels)
        for loop in loops:
            loop['points'] = [[x-left, y-top] for x, y in loop['points']]
        data['layers'].append({'color': '#D50006' if color == 'red' else '#FFFFFF', 'contours': loops})
    target = ROOT / 'src/assets/logo-contours.json'
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(data, separators=(',', ':')) + '\n')
    print(f'{target.name}: {sum(len(layer["contours"]) for layer in data["layers"])} contours, {data["width"]} × {data["height"]}')


if __name__ == '__main__':
    main()
