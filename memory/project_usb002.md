---
name: USB002 webapp project
description: Fred Again + Thomas Bangalter tribute webapp with HLS streaming
type: project
---

User is building a personal streaming webapp as a homage to the USB002 set (Fred again.. × Thomas Bangalter, Alexandra Palace London, 27 Feb 2026).

**Why:** Personal project to relive and navigate the set with timestamps.

**Tech stack:**
- Backend: Node.js + Express (`server.js`), port 3001
- Frontend: React + Vite (`client/`), dev on port 5173
- Streaming: HLS via hls.js, FFmpeg transcoding (`transcode.js`)
- Fonts: Space Mono (Google Fonts)

**Status:** Initial build complete, committed. User has the source WebM (~3.5GB, 1h56m23s).

**Next steps for user:**
1. Place webm in `media/` folder
2. Run `node transcode.js media/filename.webm` (FFmpeg required)
3. Adjust timestamps in `client/src/data/tracklist.json` to match exact video times
4. Run `npm start` for server + `cd client && npm run dev` for dev mode

**How to apply:** When user asks about this project, reference the stack above. The tracklist timestamps in tracklist.json are approximate — user needs to adjust them against the actual video.
