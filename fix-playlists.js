/**
 * Regenerates HLS playlists for the 720p, 480p, 360p, and audio streams.
 *
 * The original transcode placed -hls_time/-hls_playlist_type/-hls_flags before
 * all outputs in a single FFmpeg command. FFmpeg treats these as per-output
 * options — they applied only to the first output (1080p). The other streams
 * were encoded at the default 2-second segment duration but ended up with the
 * 1080p playlist (1164 entries × 6s), so playback stopped at ~38 minutes.
 *
 * This script probes every segment in each affected stream with ffprobe,
 * then writes a correct playlist.m3u8.
 *
 * Usage:
 *   node fix-playlists.js
 *
 * Reads from: media/hls/{720p,480p,360p,audio}/seg*.ts
 * Writes to:  media/hls/{720p,480p,360p,audio}/playlist.m3u8
 */

import { spawn } from 'child_process';
import { writeFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HLS = join(__dirname, 'media', 'hls');
const STREAMS = ['720p', '480p', '360p', 'audio'];
const CONCURRENCY = 12; // parallel ffprobe workers

function probeDuration(filePath) {
  return new Promise((resolve) => {
    const proc = spawn('ffprobe', [
      '-v', 'quiet',
      '-show_entries', 'format=duration',
      '-of', 'csv=p=0',
      filePath,
    ]);
    let out = '';
    proc.stdout.on('data', d => { out += d; });
    proc.on('close', () => {
      const dur = parseFloat(out.trim());
      // Resolve with 0 for any segment that can't be probed (e.g. tiny trailing stub)
      resolve(isNaN(dur) ? 0 : dur);
    });
  });
}

async function probeAll(dir) {
  const segments = readdirSync(dir)
    .filter(f => f.endsWith('.ts'))
    .sort();

  const total = segments.length;
  const durations = new Array(total);
  let done = 0;

  // Process in CONCURRENCY-wide sliding windows
  for (let i = 0; i < total; i += CONCURRENCY) {
    const batch = segments.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map(seg => probeDuration(join(dir, seg)))
    );
    results.forEach((dur, j) => { durations[i + j] = dur; });
    done += batch.length;
    const pct = Math.round((done / total) * 100);
    process.stdout.write(`\r  ${dir.split('/').pop()}: ${pct}% (${done}/${total})    `);
  }
  console.log();
  return { segments, durations };
}

function writePlaylist(dir, segments, durations) {
  const validDurations = durations.filter(d => d > 0);
  const targetDuration = Math.ceil(Math.max(...validDurations));
  const lines = [
    '#EXTM3U',
    '#EXT-X-VERSION:6',
    `#EXT-X-TARGETDURATION:${targetDuration}`,
    '#EXT-X-MEDIA-SEQUENCE:0',
    '#EXT-X-PLAYLIST-TYPE:VOD',
    '#EXT-X-INDEPENDENT-SEGMENTS',
  ];
  for (let i = 0; i < segments.length; i++) {
    if (durations[i] === 0) continue; // skip unreadable stub segments
    lines.push(`#EXTINF:${durations[i].toFixed(6)},`);
    lines.push(segments[i]);
  }
  lines.push('#EXT-X-ENDLIST');
  writeFileSync(join(dir, 'playlist.m3u8'), lines.join('\n') + '\n');
}

console.log('\n  fix-playlists — probing segments and writing correct playlists\n');

for (const stream of STREAMS) {
  const dir = join(HLS, stream);
  console.log(`  Probing ${stream}...`);
  const { segments, durations } = await probeAll(dir);
  const totalSecs = durations.reduce((a, b) => a + b, 0);
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = Math.round(totalSecs % 60);
  console.log(`  ${stream}: ${segments.length} segments, total ${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`);
  writePlaylist(dir, segments, durations);
  console.log(`  Wrote ${stream}/playlist.m3u8\n`);
}

console.log('  Done. All playlists fixed.\n');
