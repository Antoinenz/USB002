/**
 * Transcodes the source WebM into HLS streams at multiple bitrates.
 * Requires FFmpeg to be installed and available in PATH.
 *
 * Usage:
 *   node transcode.js media/set.webm            ← CPU (libx264)
 *   node transcode.js media/set.webm --nvenc    ← NVIDIA GPU (Quadro P2000)
 *
 * Output structure:
 *   media/hls/master.m3u8        ← adaptive master playlist
 *   media/hls/1080p/             ← ~4500k video + 192k audio
 *   media/hls/720p/              ← ~2800k video + 160k audio
 *   media/hls/480p/              ← ~1400k video + 128k audio
 *   media/hls/360p/              ← ~800k  video + 96k audio
 *   media/hls/audio/             ← audio-only AAC, ~192k
 */

import { spawn } from 'child_process';
import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const INPUT = process.argv[2];
const USE_NVENC = process.argv.includes('--nvenc');

if (!INPUT || !existsSync(INPUT)) {
  console.error('\nUsage: node transcode.js <path-to-input.webm> [--nvenc]\n');
  process.exit(1);
}

const OUT = join(__dirname, 'media', 'hls');

const RENDITIONS = [
  { name: '1080p', scale: '1920:1080', vb: '4500k', maxrate: '4950k', bufsize: '9000k', ab: '192k' },
  { name: '720p',  scale: '1280:720',  vb: '2800k', maxrate: '3080k', bufsize: '5600k', ab: '160k' },
  { name: '480p',  scale: '854:480',   vb: '1400k', maxrate: '1540k', bufsize: '2800k', ab: '128k' },
  { name: '360p',  scale: '640:360',   vb: '800k',  maxrate: '880k',  bufsize: '1600k', ab: '96k'  },
];

// Create output directories
[...RENDITIONS.map(r => r.name), 'audio'].forEach(dir => {
  mkdirSync(join(OUT, dir), { recursive: true });
});

function videoEncodeArgs(r) {
  if (USE_NVENC) {
    return [
      '-c:v', 'h264_nvenc',
      '-preset', 'p4',        // p1=fastest … p7=best quality
      '-profile:v', 'high',
      '-level', '4.1',
      '-rc', 'vbr',
      '-b:v', r.vb,
      '-maxrate', r.maxrate,
      '-bufsize', r.bufsize,
      '-g', '48',
      '-forced-idr', '1',
    ];
  }
  return [
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-profile:v', 'high',
    '-level', '4.1',
    '-b:v', r.vb,
    '-maxrate', r.maxrate,
    '-bufsize', r.bufsize,
    '-g', '48',
    '-sc_threshold', '0',
    '-keyint_min', '48',
  ];
}

// With NVENC: use NVDEC for hardware VP9/VP8 decode so the CPU only scales + manages IO.
// filter_complex split decodes the video exactly once and fans it out to all encoders.
// Without this, FFmpeg runs a full decode pipeline per -map, which buries the CPU.
const decodeArgs = USE_NVENC ? ['-hwaccel', 'cuda'] : [];

const filterParts = [
  `[0:v]split=${RENDITIONS.length}${RENDITIONS.map((_, i) => `[raw${i}]`).join('')}`,
  ...RENDITIONS.map((r, i) =>
    `[raw${i}]scale=${r.scale}:force_original_aspect_ratio=decrease,pad=${r.scale}:(ow-iw)/2:(oh-ih)/2[v${i}]`
  ),
];

// Build FFmpeg arguments — decode once, split, encode all renditions in one pass
const args = [
  ...decodeArgs,
  '-i', INPUT,
  '-y',
  '-filter_complex', filterParts.join(';'),
  '-hls_time', '6',
  '-hls_playlist_type', 'vod',
  '-hls_flags', 'independent_segments',
];

RENDITIONS.forEach((r, i) => {
  args.push(
    '-map', `[v${i}]`,
    '-map', '0:a',
    ...videoEncodeArgs(r),
    '-c:a', 'aac',
    '-b:a', r.ab,
    '-ac', '2',
    '-ar', '44100',
    '-hls_segment_filename', join(OUT, r.name, 'seg%04d.ts'),
    join(OUT, r.name, 'playlist.m3u8'),
  );
});

// Audio-only output
args.push(
  '-map', '0:a',
  '-vn',
  '-c:a', 'aac',
  '-b:a', '192k',
  '-ac', '2',
  '-ar', '44100',
  '-hls_segment_filename', join(OUT, 'audio', 'seg%04d.ts'),
  join(OUT, 'audio', 'playlist.m3u8'),
);

const encoderLabel = USE_NVENC ? 'h264_nvenc (Quadro P2000)' : 'libx264 (CPU)';
console.log('\n  USB002 — transcoding started');
console.log(`  Encoder: ${encoderLabel}`);
console.log(`  Input  : ${INPUT}`);
console.log(`  Output : ${OUT}`);
if (USE_NVENC) {
  console.log('  NVENC: expect ~10–20min for a 2h set at p4 preset.\n');
} else {
  console.log('  CPU: this will take a while. Consider --nvenc if you have an NVIDIA GPU.\n');
}

const ffmpeg = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });

let durationSecs = 0;

ffmpeg.stderr.on('data', (data) => {
  const str = data.toString();

  // Parse total duration once
  if (!durationSecs) {
    const m = str.match(/Duration:\s*(\d+):(\d+):(\d+)/);
    if (m) durationSecs = parseInt(m[1]) * 3600 + parseInt(m[2]) * 60 + parseInt(m[3]);
  }

  // Parse current time for progress
  const t = str.match(/time=(\d+):(\d+):(\d+)/);
  if (t && durationSecs) {
    const elapsed = parseInt(t[1]) * 3600 + parseInt(t[2]) * 60 + parseInt(t[3]);
    const pct = Math.round((elapsed / durationSecs) * 100);
    process.stdout.write(`\r  Progress: ${pct}% (${t[0].replace('time=', '')} / ${formatTime(durationSecs)})    `);
  }
});

ffmpeg.on('close', (code) => {
  if (code !== 0) {
    console.error('\n\n  FFmpeg exited with error. Make sure FFmpeg is installed.\n');
    process.exit(1);
  }

  // Write master HLS playlist
  const master = [
    '#EXTM3U',
    '#EXT-X-VERSION:3',
    '',
    '#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",NAME="Audio Only",DEFAULT=NO,AUTOSELECT=NO,URI="audio/playlist.m3u8"',
    '',
    '#EXT-X-STREAM-INF:BANDWIDTH=4692000,RESOLUTION=1920x1080,CODECS="avc1.640028,mp4a.40.2",AUDIO="audio"',
    '1080p/playlist.m3u8',
    '#EXT-X-STREAM-INF:BANDWIDTH=2960000,RESOLUTION=1280x720,CODECS="avc1.640028,mp4a.40.2",AUDIO="audio"',
    '720p/playlist.m3u8',
    '#EXT-X-STREAM-INF:BANDWIDTH=1528000,RESOLUTION=854x480,CODECS="avc1.640028,mp4a.40.2",AUDIO="audio"',
    '480p/playlist.m3u8',
    '#EXT-X-STREAM-INF:BANDWIDTH=896000,RESOLUTION=640x360,CODECS="avc1.640028,mp4a.40.2",AUDIO="audio"',
    '360p/playlist.m3u8',
  ].join('\n');

  writeFileSync(join(OUT, 'master.m3u8'), master);

  console.log('\n\n  Done. Start the server: npm start\n');
});

function formatTime(secs) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
