# USB002

A personal streaming webapp — homage to the Fred again.. × Thomas Bangalter back-to-back at Alexandra Palace, London, 27 February 2026.

Dark, monospace, minimal. A track queue you can jump around with one click.

---

## Stack

| Layer | Tech |
|---|---|
| Server | Node.js + Express |
| Streaming | HLS (HTTP Live Streaming) via hls.js |
| Transcoding | FFmpeg — CPU or NVIDIA NVENC |
| Frontend | React + Vite |
| Font | Space Mono |

---

## Prerequisites

- **Node.js** 18+
- **FFmpeg** installed and on your PATH ([ffmpeg.org](https://ffmpeg.org/download.html))
- The source WebM file (~3.5 GB, 1h56m23s)
- *(Optional)* An NVIDIA GPU with NVENC support for fast transcoding

---

## Setup

### 1. Install dependencies

```bash
npm install
cd client && npm install && cd ..
```

### 2. Place your source file

Drop your WebM into the `media/` directory. The filename doesn't matter.

### 3. Transcode to HLS

This is a one-time step. It creates adaptive bitrate HLS streams at 1080p / 720p / 480p / 360p plus an audio-only stream.

**CPU (slower — ~2–3h for a 2h set):**
```bash
node transcode.js media/USB002.webm
```

**NVIDIA GPU via NVENC (fast — ~10–20 min):**
```bash
node transcode.js media/USB002.webm --nvenc
```

NVENC also uses NVDEC for hardware VP9/VP8 decoding, so it offloads both decode and encode from the CPU. The source WebM is decoded exactly once and split into all four renditions via a single FFmpeg filter graph.

Output is written to `media/hls/`:
```
media/hls/
  master.m3u8        ← adaptive master playlist (auto quality switching)
  1080p/playlist.m3u8 + seg*.ts
  720p/playlist.m3u8  + seg*.ts
  480p/playlist.m3u8  + seg*.ts
  360p/playlist.m3u8  + seg*.ts
  audio/playlist.m3u8 + seg*.ts   ← audio-only stream
```

If you need to restart the transcode, wipe the partial output first:
```bash
# Windows
rd /s /q media\hls && mkdir media\hls

# Unix
rm -rf media/hls && mkdir media/hls
```

### 4. Run

**Development** (hot reload on the client):
```bash
# Terminal 1
npm start          # Express server on :3011

# Terminal 2
cd client && npm run dev   # Vite dev server on :5173
```
Open `http://localhost:5173`

**Production** (single server):
```bash
cd client && npm run build && cd ..
npm start
```
Open `http://localhost:3011`

The server is exposed on all network interfaces (`host: true`), so it's accessible from other devices on your LAN.

---

## Timestamps

Track timestamps are in `client/src/data/tracklist.json`. The values are in **seconds** from the start of the video. The current values are approximations — scrub through your video and update them to the real positions.

```json
{
  "id": 1,
  "title": "L'Accouchement",
  "artist": "Thomas Bangalter",
  "timestamp": 0,
  "note": "Opening — Bangalter's orchestral composition"
}
```

After editing `tracklist.json`, just refresh the browser — no server restart needed in dev mode.

---

## Controls

| Input | Action |
|---|---|
| `Space` | Play / pause |
| `← / →` | Seek ±10 seconds |
| `Shift + ← / →` | Previous / next track |
| `M` | Mute |
| Click track | Jump to that timestamp |
| Click progress bar | Seek to position |
| Hover progress bar | Preview timestamp + track name |
| AUTO / 1080 / 720 / 480 / 360 buttons | Manual quality override |
| VIDEO / AUDIO toggle | Switch to audio-only stream |

---

## Project structure

```
USB002/
├── server.js                  Express server (port 3011)
├── transcode.js               FFmpeg HLS transcoding script
├── package.json
├── client/
│   ├── vite.config.js
│   ├── index.html
│   └── src/
│       ├── App.jsx            Layout, state, keyboard shortcuts
│       ├── App.css            Dark theme, Space Mono
│       ├── components/
│       │   ├── VideoPlayer.jsx   hls.js wrapper, quality + mode control
│       │   └── TrackList.jsx     Scrollable track queue
│       └── data/
│           └── tracklist.json   Track titles, artists, timestamps (seconds)
└── media/
    ├── USB002.webm            Source file (gitignored)
    └── hls/                   Transcoded output (gitignored)
```

---

## The set

**Fred again.. × Thomas Bangalter**  
USB002 residency, night 4 of 4  
Alexandra Palace Great Hall, London — 27 February 2026

Thomas Bangalter's first DJ set in London in over 16 years. The venue was transformed by a 70-metre fabric installation by Boris Acket that rippled and breathed with the music. Fred called it "the greatest show of my life."

Full tracklist in `client/src/data/tracklist.json`.
