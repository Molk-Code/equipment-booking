// Vercel serverless function: lists images from a public Google Drive folder
// and returns a JSON map of { filename (without extension) → direct image URL }

const FOLDER_ID = '1_mWbPzJF-mAAehJTtRAJnrLJGVvhJvHH';

export default async function handler(req, res) {
  // Allow CORS from any origin (our Vercel frontend)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  // Cache for 30s on Vercel's edge, serve stale for 60s while revalidating
  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');

  try {
    // Fetch the embedded folder view — server-rendered HTML, no API key needed
    const url = `https://drive.google.com/embeddedfolderview?id=${FOLDER_ID}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; EquipmentBooking/1.0)',
      },
    });

    if (!response.ok) {
      throw new Error(`Drive returned ${response.status}`);
    }

    const html = await response.text();
    const manifest = {};

    // The embedded view contains links like:
    //   href="https://drive.google.com/file/d/FILE_ID/view..."
    // followed by a title div:
    //   <div class="flip-entry-title">FILENAME.ext</div>
    //
    // We match the href → title pairs to get ID + filename.
    const entryRegex = /href="https:\/\/drive\.google\.com\/file\/d\/([^/]+)\/view[^"]*"[\s\S]*?<div class="flip-entry-title">([^<]+)<\/div>/g;

    let match;
    while ((match = entryRegex.exec(html)) !== null) {
      const fileId = match[1];
      const rawName = match[2].trim();

      // Only include image files
      if (!/\.(jpg|jpeg|png|gif|webp)$/i.test(rawName)) continue;

      // Strip file extension to get the base name for matching
      const baseName = rawName.replace(/\.[^.]*$/, '');

      // Build a direct image URL using Google's image CDN
      const imageUrl = `https://lh3.googleusercontent.com/d/${fileId}=w800`;

      manifest[baseName] = imageUrl;
    }

    // Fallback: try id="entry-FILEID" pattern if href pattern didn't match
    if (Object.keys(manifest).length === 0) {
      const fallbackRegex = /id="entry-([^"]+)"[\s\S]*?<div class="flip-entry-title">([^<]+)<\/div>/g;
      while ((match = fallbackRegex.exec(html)) !== null) {
        const fileId = match[1];
        const rawName = match[2].trim();
        if (!/\.(jpg|jpeg|png|gif|webp)$/i.test(rawName)) continue;
        const baseName = rawName.replace(/\.[^.]*$/, '');
        const imageUrl = `https://lh3.googleusercontent.com/d/${fileId}=w800`;
        manifest[baseName] = imageUrl;
      }
    }

    res.status(200).json(manifest);
  } catch (err) {
    console.error('Drive images error:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch drive images' });
  }
}
