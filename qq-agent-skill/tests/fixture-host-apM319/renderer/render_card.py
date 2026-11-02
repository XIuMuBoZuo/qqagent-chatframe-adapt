import base64
import json
from pathlib import Path
import sys

req = json.load(sys.stdin)
out = Path(sys.argv[sys.argv.index('--output-dir') + 1])
text = req.get('text')
if text == '__overflow__':
    print(json.dumps({'ok': False, 'error': {'code': 'TEXT_OVERFLOW', 'message': 'fixture'}}))
    sys.exit(2)
if text == '__wrong_path__':
    print(json.dumps({'ok': True, 'image_path': str(out.parent / 'not-allowed.png'), 'width': 1, 'height': 1}))
    sys.exit(0)
out.mkdir(exist_ok=True)
result = out / 'fixture.png'
if text == '__bad_png__':
    result.write_bytes(b'not a valid PNG at all, invalid image')
else:
    result.write_bytes(base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1sAAAAASUVORK5CYII='))
print(json.dumps({'ok': True, 'image_path': str(result), 'width': 1, 'height': 1}))
