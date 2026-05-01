import express from 'express';
import cors from 'cors';
import { createReadStream, existsSync, statSync } from 'fs';
import { join, extname, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3011;
const HLS_DIR = join(__dirname, 'media', 'hls');
const CLIENT_DIST = join(__dirname, 'client', 'dist');

app.use(cors());
app.use(express.json());

// HLS stream with proper content types and range support
app.use('/stream', (req, res) => {
  const filePath = join(HLS_DIR, req.path);

  if (!existsSync(filePath)) {
    return res.status(404).json({
      error: 'Stream not found.',
      hint: 'Run: node transcode.js media/your-file.webm'
    });
  }

  const ext = extname(filePath);

  if (ext === '.m3u8') {
    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.setHeader('Cache-Control', 'no-cache');
    return res.sendFile(filePath);
  }

  if (ext === '.ts') {
    const stat = statSync(filePath);
    const total = stat.size;
    const range = req.headers.range;

    res.setHeader('Content-Type', 'video/mp2t');

    if (range) {
      const [startStr, endStr] = range.replace(/bytes=/, '').split('-');
      const start = parseInt(startStr, 10);
      const end = endStr ? parseInt(endStr, 10) : total - 1;
      const chunkSize = end - start + 1;
      res.setHeader('Content-Range', `bytes ${start}-${end}/${total}`);
      res.setHeader('Content-Length', chunkSize);
      res.setHeader('Accept-Ranges', 'bytes');
      res.status(206);
      createReadStream(filePath, { start, end }).pipe(res);
    } else {
      res.setHeader('Content-Length', total);
      createReadStream(filePath).pipe(res);
    }
    return;
  }

  res.sendFile(filePath);
});

// Tracklist API — client reads this so timestamps can be edited server-side
app.get('/api/tracklist', (req, res) => {
  res.sendFile(join(__dirname, 'client', 'src', 'data', 'tracklist.json'));
});

// Serve built React app in production
if (existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));
  app.get('*', (req, res) => res.sendFile(join(CLIENT_DIST, 'index.html')));
}

app.listen(PORT, () => {
  console.log(`\n  USB002\n  http://localhost:${PORT}\n`);
});
