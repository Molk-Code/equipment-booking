#!/bin/bash
# Regenerate the image manifest from the bilder folder.
# Run this after adding/removing images in public/bilder/
# (Not normally needed — the Vite plugin does this automatically)
cd "$(dirname "$0")"

python3 -c "
import os, json
d = os.path.join(os.getcwd(), 'public', 'bilder')
files = [f for f in os.listdir(d) if f.lower().endswith(('.jpg','.jpeg','.png','.gif','.webp'))]
manifest = {}
for f in sorted(files):
    name = os.path.splitext(f)[0]
    manifest[name] = '/bilder/' + f
with open(os.path.join(d, 'manifest.json'), 'w') as out:
    json.dump(manifest, out, indent=2, ensure_ascii=False)
print(f'Manifest generated with {len(manifest)} images.')
"
