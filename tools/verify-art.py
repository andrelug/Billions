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
    path = root / 'assets' / entry['file']
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
                if key.startswith(('terrain/', 'mayor/')):
                    if alpha.getextrema()[0] != 255:
                        errors.append(f'{key}: tile/portrait has transparent pixels')
                elif alpha.getextrema() != (0, 255):
                    errors.append(f'{key}: sprite does not have transparent outside and solid subject')
                if entry.get('frames', 1) > 1:
                    fingerprints = set()
                    for frame in range(entry['frames']):
                        cell = image.crop((frame * entry['w'], 0, (frame + 1) * entry['w'], entry['h']))
                        if cell.convert('RGBA').getchannel('A').getextrema() != (0, 255):
                            errors.append(f'{key}: animation frame {frame + 1} is empty or lacks alpha')
                        fingerprints.add(hashlib.sha256(cell.tobytes()).digest())
                    if len(fingerprints) < 3:
                        errors.append(f'{key}: fewer than three distinct animation poses')
    except Exception as error:
        errors.append(f'{key}: {error}')
print(f'{len(ledger)}/{len(manifest)} original generated sprites; all {len(manifest)} files decoded.')
if errors:
    raise SystemExit('\n'.join(errors))
print('Manifest dimensions, alpha and delivered file hashes verified.')
