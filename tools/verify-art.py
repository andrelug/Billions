"""Decode delivered images and check the renderer manifest and provenance."""
from pathlib import Path
from PIL import Image
import hashlib
import json

root = Path(__file__).resolve().parent.parent
manifest = json.loads((root / 'assets/manifest.json').read_text())
ledger = json.loads((root / 'art/generated.json').read_text())
errors = []
for key, entry in manifest.items():
    if key == 'ui/vars':
        if any(not name.startswith('--') for name in entry):
            errors.append('ui/vars: expected CSS custom properties')
        continue
    path = root / 'assets' / entry['file']
    if key == 'ui/font':
        if not path.exists() or path.read_bytes()[:4] != b'wOF2':
            errors.append('ui/font: missing or invalid WOFF2 font')
        if not (path.parent / 'OFL.txt').exists():
            errors.append('ui/font: missing distribution license')
        continue
    try:
        with Image.open(path) as image:
            image.load()
            expected = (entry['w'] * entry.get('frames', 1), entry['h'])
            if image.size != expected:
                errors.append(f'{key}: {image.size} != {expected}')
            if key in ledger:
                if hashlib.sha256(path.read_bytes()).hexdigest() != ledger[key]['sha256']:
                    errors.append(f'{key}: delivered artwork changed since installation')
                alpha = image.convert('RGBA').getchannel('A')
                if key.startswith(('terrain/', 'mayor/')) or key == 'ui/title_bg':
                    if alpha.getextrema()[0] != 255:
                        errors.append(f'{key}: tile/portrait has transparent pixels')
                elif alpha.getextrema()[0] != 0 or alpha.getextrema()[1] < 250:
                    errors.append(f'{key}: sprite does not have transparent outside and solid subject')
                if ledger[key].get('update') == 'tab-scale-2026-10' and key.startswith(('building/', 'nest/', 'prop/')):
                    box = alpha.point(lambda value: 255 if value > 40 else 0).getbbox()
                    if not box or image.height - box[3] > 1:
                        errors.append(f'{key}: object base does not touch the canvas bottom')
                if ledger[key].get('update') == 'tab-scale-2026-10' and key.startswith(('unit/', 'infected/')):
                    heights = []
                    for frame in range(entry.get('frames', 1)):
                        cell = image.crop((frame * entry['w'], 0, (frame + 1) * entry['w'], entry['h'])).convert('RGBA')
                        mask = cell.getchannel('A').point(lambda value: 255 if value > 40 else 0)
                        box = mask.getbbox()
                        if not box:
                            errors.append(f'{key}: frame {frame + 1} has no body')
                            continue
                        heights.append((box[3] - box[1]) / entry['h'])
                        if abs(box[3] / entry['h'] - 0.9) > 0.012:
                            errors.append(f'{key}: frame {frame + 1} feet miss the 90% baseline')
                        pixels = mask.load()
                        foot_pixels = [x + 0.5
                                       for y in range(box[3] - (box[3] - box[1]) // 5, box[3])
                                       for x in range(box[0], box[2]) if pixels[x, y]]
                        if foot_pixels and abs(sum(foot_pixels) / len(foot_pixels) / entry['w'] - 0.5) > 0.012:
                            errors.append(f'{key}: frame {frame + 1} foot centre drifts horizontally')
                    if heights and not 0.68 <= max(heights) <= 0.79:
                        errors.append(f'{key}: body height {max(heights):.2%} misses the 75% framing target')
                if entry.get('frames', 1) > 1:
                    fingerprints = set()
                    for frame in range(entry['frames']):
                        cell = image.crop((frame * entry['w'], 0, (frame + 1) * entry['w'], entry['h']))
                        if cell.convert('RGBA').getchannel('A').getextrema()[0] != 0 or cell.convert('RGBA').getchannel('A').getextrema()[1] < 250:
                            errors.append(f'{key}: animation frame {frame + 1} is empty or lacks alpha')
                        fingerprints.add(hashlib.sha256(cell.tobytes()).digest())
                    if len(fingerprints) < 3:
                        errors.append(f'{key}: fewer than three distinct animation poses')
    except Exception as error:
        errors.append(f'{key}: {error}')
raster_count = sum(1 for key, value in manifest.items() if key not in ('ui/vars', 'ui/font') and value.get('file'))
current_records = sum(1 for key in manifest if key in ledger)
print(f'{current_records}/{raster_count} active generated image records; {raster_count} raster files decoded; font and metadata checked.')
if errors:
    raise SystemExit('\n'.join(errors))
print('Manifest dimensions, alpha and delivered file hashes verified.')
