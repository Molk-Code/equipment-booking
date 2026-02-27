#!/bin/bash
# Regenerate the image manifest from the bilder folder.
# Run this after adding/removing images in public/bilder/
cd "$(dirname "$0")/public/bilder" || exit 1

echo '{' > manifest.json
first=true
for f in *; do
  case "$f" in
    *.jpg|*.jpeg|*.png|*.gif|*.webp) ;;
    *) continue ;;
  esac
  name="${f%.*}"
  if [ "$first" = true ]; then
    first=false
  else
    printf ',\n' >> manifest.json
  fi
  printf '  "%s": "/bilder/%s"' "$name" "$f" >> manifest.json
done
printf '\n}\n' >> manifest.json
echo "Manifest generated with $(grep -c '"/bilder/' manifest.json) images."
