# USB002 — Claude Session Handoff

This document gives a new Claude Code session full context to continue work on this project without re-explaining everything.

---

## What this is

A personal self-hosted streaming webapp — a homage to the Fred again.. × Thomas Bangalter USB002 set at Alexandra Palace, London, 27 Feb 2026 (1h56m23s). The user has the full set as a local WebM file (~3.5 GB). The app streams it via HLS with adaptive bitrate, has an audio-only mode, and a sidebar track queue with timestamps for jumping to favourite moments.

---

## Current state

Fully built and working. Transcoding is in progress on the user's machine (NVENC mode). The frontend has not been visually tested against the running server yet — transcoding needs to finish first.

**Git:** single commit on `main` — `89508f7 Initial commit: USB002 streaming webapp`

---

## Tech stack

- **Server:** Node.js + Express, `server.js`, port **3011**
- **Client:** React 18 + Vite, `client/`, dev port **5173**
- **Streaming:** HLS via `hls.js` in the browser; FFmpeg generates segments
- **Font:** Space Mono (Google Fonts)
- **Styling:** Plain CSS in `client/src/App.css` — no CSS framework

---

## Key files

| File | Purpose |
|---|---|
| `server.js` | Express — serves `/stream/*` HLS files, `/api/tracklist`, and `client/dist` in production |
| `transcode.js` | FFmpeg script — converts source WebM to multi-bitrate HLS + audio-only |
| `client/src/App.jsx` | Main layout, all state, keyboard shortcuts |
| `client/src/App.css` | Dark theme, Space Mono, full layout CSS |
| `client/src/components/VideoPlayer.jsx` | `forwardRef` hls.js wrapper; exposes `seek`, `play`, `pause`, `currentTime`, `duration`, `setVolume`, `setMuted` |
| `client/src/components/TrackList.jsx` | Scrollable track queue; auto-scrolls to active track |
| `client/src/data/tracklist.json` | Track titles, artists, timestamps in **seconds** — user needs to verify/adjust against actual video |

---

## Ports & config

- Server port: `3011` (changed from default 3001 because 3001 was in use on this machine)
- Vite dev proxy: `/stream` and `/api` → `http://localhost:3011`
- `host: true` in vite.config.js — accessible on LAN

---

## HLS output structure

After `node transcode.js media/USB002.webm --nvenc` completes:

```
media/hls/
  master.m3u8          ← adaptive master (client loads this)
  1080p/playlist.m3u8 + seg*.ts
  720p/playlist.m3u8  + seg*.ts
  480p/playlist.m3u8  + seg*.ts
  360p/playlist.m3u8  + seg*.ts
  audio/playlist.m3u8 + seg*.ts   ← audio-only AAC ~192k
```

The client fetches `/stream/master.m3u8` for video, `/stream/audio/playlist.m3u8` for audio-only mode.

---

## Transcoding decisions (so you don't re-explain)

- **Why not resume HLS mid-transcode:** FFmpeg numbers segments from 0000 on every run. A partial run can't be resumed cleanly — must wipe and restart.
- **NVENC setup:** `-hwaccel cuda` offloads VP9 decode to NVDEC (Quadro P2000). `filter_complex` with `split` decodes the video exactly once and fans out to 4 scale chains, avoiding 4× CPU decode pipelines.
- **CPU encoder:** `libx264 -preset fast` — used without `--nvenc`
- **GPU encoder:** `h264_nvenc -preset p4 -rc vbr` — `p4` is a balanced preset (p1=fastest, p7=best quality)
- **Segment length:** 6 seconds (`-hls_time 6`)
- **GOP:** 48 frames, forced IDR, aligned to segment boundaries

---

## Tracklist

Timestamps in `client/src/data/tracklist.json` are **approximate** — based on the known tracklist order but not frame-accurate. The user will need to scrub through the video and fill in real values (in seconds). 21 tracks total over 1h56m23s (6983 seconds).

Tracks include: Bangalter's "L'Accouchement" (Mythologies), multiple Daft Punk tracks, Fred again.. originals (Marea, Baby Again.., places to be, Victory Lap Five), 808 State Cubik, Wildchild Renegade Master, Usher Yeah!, The Weeknd Starboy, Stardust Music Sounds Better With You, Animal Collective My Girls.

---

## Design

- Background: `#000`
- Text: `#fff` / `#444` (dim) / `#222` (dimmer)
- Font: Space Mono throughout
- Layout: fixed header → (video player | track list) → controls bar, CSS Grid
- No animations except a pulsing dot on the now-playing indicator
- Track markers on the progress bar at each track timestamp
- Hover on progress bar shows tooltip with time + track name

---

## What's not done yet

1. **Timestamp accuracy** — `tracklist.json` values are estimates. Once transcoding is done the user will watch/scrub and fix them.
2. **Visual QA** — the UI hasn't been tested against a live stream yet (transcoding in progress).
3. **No auth** — this is an entirely personal/local app, no auth needed.
4. **Mobile** — basic responsive CSS is in place but untested.

---

## User's hardware (relevant context)

- CPU: Intel i7-5820K
- GPU 1: NVIDIA Quadro P2000 — used for NVENC encode + NVDEC decode
- GPU 2: AMD R7 370 — not used for transcoding (no NVENC, AMF quality not worth it)
- OS: Windows 10

---

## How to run

```bash
# Dev
npm start                        # server on :3011
cd client && npm run dev         # client on :5173 with proxy

# Production
cd client && npm run build && cd ..
npm start                        # serves built client + API on :3011
```
