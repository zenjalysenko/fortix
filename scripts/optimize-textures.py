"""Generate browser textures from the original PNG catalogue (requires Pillow)."""
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1] / 'assets' / 'textures'
original_bytes = runtime_bytes = 0
sources = sorted(root.glob('*.png')) + sorted((root / 'characters').glob('*.png'))
for source in sources:
    target = root / 'runtime' / source.relative_to(root).with_suffix('.webp')
    target.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(source) as image:
        size = 1024 if source.stem in ('hero-face', 'enemy-mask') else 512
        image.thumbnail((size, size), Image.Resampling.LANCZOS)
        image.save(target, 'WEBP', quality=82, method=6)
    with Image.open(target) as result:
        assert min(result.size) >= 512 and result.format == 'WEBP', target
    original_bytes += source.stat().st_size
    runtime_bytes += target.stat().st_size
assert len(sources) == 18 and runtime_bytes < original_bytes / 4
print(f'{len(sources)} textures: {original_bytes / 1e6:.2f} MB -> {runtime_bytes / 1e6:.2f} MB')
