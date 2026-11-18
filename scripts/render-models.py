"""Render the exported GLB catalogue with NumPy/Pillow, without a GPU or browser."""
import json
import math
import struct
from functools import lru_cache
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
MODELS = ROOT / 'assets' / 'models'
CELL = 320
DTYPES = {5121: 'u1', 5123: '<u2', 5125: '<u4', 5126: '<f4'}
COMPONENTS = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}


@lru_cache(maxsize=24)
def texture(path):
    return np.asarray(Image.open(path).convert('RGB'), dtype=np.float32) / 255


def read_model(path):
    data = path.read_bytes()
    size = struct.unpack_from('<I', data, 12)[0]
    doc = json.loads(data[20:20 + size])
    binary = data[28 + size:]

    def accessor(index):
        spec = doc['accessors'][index]
        view = doc['bufferViews'][spec['bufferView']]
        dtype = np.dtype(DTYPES[spec['componentType']])
        width = COMPONENTS[spec['type']]
        offset = view.get('byteOffset', 0) + spec.get('byteOffset', 0)
        stride = view.get('byteStride', width * dtype.itemsize)
        array = np.ndarray((spec['count'], width), dtype=dtype, buffer=binary, offset=offset, strides=(stride, dtype.itemsize))
        result = array.astype(np.float32)
        if spec.get('normalized') and dtype.kind == 'u':
            result /= np.iinfo(dtype).max
        return result

    parts = []

    def visit(index, parent):
        node = doc['nodes'][index]
        if 'matrix' in node:
            local = np.array(node['matrix']).reshape(4, 4).T
        else:
            x, y, z, w = node.get('rotation', [0, 0, 0, 1])
            local = np.eye(4)
            local[:3, :3] = [[1 - 2*(y*y+z*z), 2*(x*y-z*w), 2*(x*z+y*w)], [2*(x*y+z*w), 1 - 2*(x*x+z*z), 2*(y*z-x*w)], [2*(x*z-y*w), 2*(y*z+x*w), 1 - 2*(x*x+y*y)]]
            local[:3, :3] *= node.get('scale', [1, 1, 1])
            local[:3, 3] = node.get('translation', [0, 0, 0])
        world = parent @ local
        if 'mesh' in node:
            for primitive in doc['meshes'][node['mesh']]['primitives']:
                attrs = primitive['attributes']
                positions = accessor(attrs['POSITION'])
                vertices = np.column_stack([positions, np.ones(len(positions))]) @ world.T
                indices = accessor(primitive['indices']).astype(np.int32).ravel() if 'indices' in primitive else np.arange(len(positions))
                uv = accessor(attrs['TEXCOORD_0']) if 'TEXCOORD_0' in attrs else np.zeros((len(positions), 2))
                colors = accessor(attrs['COLOR_0'])[:, :3] if 'COLOR_0' in attrs else None
                mat = doc['materials'][primitive['material']]
                pbr = mat.get('pbrMetallicRoughness', {})
                tex = pbr.get('baseColorTexture')
                image = None
                repeat, offset, wrap = np.ones(2), np.zeros(2), True
                if tex:
                    entry = doc['textures'][tex['index']]
                    image = texture(str((path.parent / doc['images'][entry['source']]['uri']).resolve()))
                    transform = tex.get('extensions', {}).get('KHR_texture_transform', {})
                    repeat = np.array(transform.get('scale', [1, 1]))
                    offset = np.array(transform.get('offset', [0, 0]))
                    wrap = doc['samplers'][entry['sampler']].get('wrapS', 10497) == 10497
                parts.append((vertices[:, :3], indices.reshape(-1, 3), uv, np.array(pbr.get('baseColorFactor', [1, 1, 1, 1]), dtype=float)[:3], image, repeat, offset, wrap, colors, mat.get('doubleSided', False)))
        for child in node.get('children', []):
            visit(child, world)

    for index in doc['scenes'][doc.get('scene', 0)]['nodes']:
        visit(index, np.eye(4))
    return parts


def render(path):
    parts = read_model(path)
    all_vertices = np.concatenate([part[0] for part in parts])
    eye = np.array([.8, .45, 1.4])
    if path.stem == 'cave':
        eye = np.array([1.4, .25, .7])
    eye /= np.linalg.norm(eye)
    right = np.cross([0, 1, 0], eye); right /= np.linalg.norm(right)
    up = np.cross(eye, right)
    basis = np.array([right, up, eye]).T
    projected = all_vertices @ basis
    low, high = projected[:, :2].min(axis=0), projected[:, :2].max(axis=0)
    scale = min((CELL - 40) / (high[0] - low[0]), (CELL - 66) / (high[1] - low[1]))
    center = (low + high) / 2
    pixels = np.empty((CELL, CELL, 3), dtype=np.float32)
    pixels[:] = [25, 37, 44]
    zbuffer = np.full((CELL, CELL), -np.inf)
    light = np.array([-.4, .8, .7]); light /= np.linalg.norm(light)
    for vertices, triangles, uv, color, image, repeat, offset, wrap, vertex_colors, double_sided in parts:
        projected = vertices @ basis
        projected[:, 0] = (projected[:, 0] - center[0]) * scale + CELL / 2
        projected[:, 1] = -(projected[:, 1] - center[1]) * scale + (CELL - 25) / 2
        for ids in triangles:
            triangle = projected[ids]
            normal = np.cross(vertices[ids[1]] - vertices[ids[0]], vertices[ids[2]] - vertices[ids[0]])
            norm = np.linalg.norm(normal)
            if norm < 1e-10:
                continue
            normal /= norm
            if not double_sided and normal @ eye < 0:
                continue
            x0, y0 = np.maximum(np.floor(triangle[:, :2].min(axis=0)).astype(int), 0)
            x1, y1 = np.minimum(np.ceil(triangle[:, :2].max(axis=0)).astype(int), CELL - 1)
            if x0 > x1 or y0 > y1:
                continue
            a, b, c = triangle
            denominator = (b[1] - c[1])*(a[0] - c[0]) + (c[0] - b[0])*(a[1] - c[1])
            if abs(denominator) < 1e-8:
                continue
            yy, xx = np.mgrid[y0:y1+1, x0:x1+1]
            u = ((b[1] - c[1])*(xx - c[0]) + (c[0] - b[0])*(yy - c[1])) / denominator
            v = ((c[1] - a[1])*(xx - c[0]) + (a[0] - c[0])*(yy - c[1])) / denominator
            w = 1 - u - v
            depth = u*a[2] + v*b[2] + w*c[2]
            target = zbuffer[y0:y1+1, x0:x1+1]
            mask = (u >= 0) & (v >= 0) & (w >= 0) & (depth > target)
            if not mask.any():
                continue
            weights = np.stack([u[mask], v[mask], w[mask]], axis=1)
            values = np.broadcast_to(color, (len(weights), 3)).copy()
            if vertex_colors is not None:
                values *= weights @ vertex_colors[ids]
            if image is not None:
                coords = (weights @ uv[ids]) * repeat + offset
                coords = coords % 1 if wrap else np.clip(coords, 0, 1)
                tx = np.minimum((coords[:, 0] * image.shape[1]).astype(int), image.shape[1] - 1)
                ty = np.minimum((coords[:, 1] * image.shape[0]).astype(int), image.shape[0] - 1)
                values *= image[ty, tx] ** 2.2
            shade = .48 + max(0, normal @ light) * .7
            rgb = np.clip(values * shade, 0, 1) ** (1 / 2.2) * 255
            pixels[y0:y1+1, x0:x1+1][mask] = rgb
            target[mask] = depth[mask]
    return Image.fromarray(pixels.astype(np.uint8))


if __name__ == '__main__':
    manifest = json.loads((MODELS / 'manifest.json').read_text())
    columns = 5
    sheet = Image.new('RGB', (CELL * columns, CELL * math.ceil(len(manifest['models']) / columns) + 56), '#101c23')
    draw = ImageDraw.Draw(sheet)
    font_path = Path('C:/Windows/Fonts/segoeui.ttf')
    font = ImageFont.truetype(str(font_path), 16) if font_path.exists() else ImageFont.load_default()
    draw.text((22, 15), 'FORTINEX  /  3D MODEL COLLECTION  /  GLB SOFTWARE PREVIEW', font=font, fill='#cfe8b4')
    for i, model in enumerate(manifest['models']):
        x, y = i % columns * CELL, i // columns * CELL + 56
        sheet.paste(render(MODELS / model['file']), (x, y))
        draw.text((x + 17, y + CELL - 28), f"{model['name'].upper()}  /  {model['triangles']} tris", font=font, fill='#e2e8dc')
        print(model['name'], flush=True)
    sheet.save(MODELS / 'preview.png')
