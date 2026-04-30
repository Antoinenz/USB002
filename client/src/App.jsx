import { useState, useEffect, useRef, useCallback } from 'react';
import VideoPlayer from './components/VideoPlayer.jsx';
import TrackList from './components/TrackList.jsx';
import tracklist from './data/tracklist.json';

const TOTAL = 6983; // 1h56m23s in seconds

function fmt(secs) {
  if (!secs || isNaN(secs)) return '0:00:00';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function getActiveTrack(currentTime, tracks) {
  let active = tracks[0];
  for (const track of tracks) {
    if (currentTime >= track.timestamp) active = track;
    else break;
  }
  return active;
}

const QUALITIES = [
  { label: 'AUTO', level: -1 },
  { label: '1080', level: 0 },
  { label: '720',  level: 1 },
  { label: '480',  level: 2 },
  { label: '360',  level: 3 },
];

export default function App() {
  const playerRef = useRef(null);
  const progressRef = useRef(null);

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(TOTAL);
  const [playing, setPlaying] = useState(false);
  const [audioOnly, setAudioOnly] = useState(false);
  const [qualityLevel, setQualityLevel] = useState(-1);
  const [levels, setLevels] = useState([]);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [tooltipX, setTooltipX] = useState(null);
  const [tooltipTime, setTooltipTime] = useState(null);
  const [tooltipTrack, setTooltipTrack] = useState(null);
  const [streamMissing, setStreamMissing] = useState(false);

  const activeTrack = getActiveTrack(currentTime, tracklist);

  // Check if stream is available
  useEffect(() => {
    fetch('/stream/master.m3u8').then(r => {
      setStreamMissing(!r.ok);
    }).catch(() => setStreamMissing(true));
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKey(e) {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'ArrowRight' && !e.shiftKey) {
        playerRef.current?.seek(Math.min((playerRef.current?.currentTime ?? 0) + 10, duration));
      } else if (e.code === 'ArrowLeft' && !e.shiftKey) {
        playerRef.current?.seek(Math.max((playerRef.current?.currentTime ?? 0) - 10, 0));
      } else if (e.code === 'ArrowRight' && e.shiftKey) {
        skipTrack(1);
      } else if (e.code === 'ArrowLeft' && e.shiftKey) {
        skipTrack(-1);
      } else if (e.code === 'KeyM') {
        toggleMute();
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [playing, duration]);

  const togglePlay = useCallback(() => {
    const p = playerRef.current;
    if (!p) return;
    if (p.paused) {
      p.play();
      setPlaying(true);
    } else {
      p.pause();
      setPlaying(false);
    }
  }, []);

  const toggleMute = useCallback(() => {
    const next = !muted;
    setMuted(next);
    playerRef.current?.setMuted(next);
  }, [muted]);

  function handleSelect(track) {
    playerRef.current?.seek(track.timestamp);
    setPlaying(true);
  }

  function skipTrack(dir) {
    const idx = tracklist.findIndex(t => t.id === activeTrack?.id);
    const next = tracklist[idx + dir];
    if (next) handleSelect(next);
  }

  function handleVolumeChange(e) {
    const v = parseFloat(e.target.value);
    setVolume(v);
    playerRef.current?.setVolume(v);
    if (v > 0 && muted) {
      setMuted(false);
      playerRef.current?.setMuted(false);
    }
  }

  // Progress bar interactions
  function getProgressTime(e) {
    const rect = progressRef.current.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    return frac * (duration || TOTAL);
  }

  function handleProgressClick(e) {
    const t = getProgressTime(e);
    playerRef.current?.seek(t);
  }

  function handleProgressMove(e) {
    const t = getProgressTime(e);
    const rect = progressRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const hoverTrack = getActiveTrack(t, tracklist);
    setTooltipX(x);
    setTooltipTime(t);
    setTooltipTrack(hoverTrack);
  }

  function handleProgressLeave() {
    setTooltipX(null);
    setTooltipTime(null);
    setTooltipTrack(null);
  }

  const progressPct = ((currentTime / (duration || TOTAL)) * 100).toFixed(3);

  // Available quality labels — fall back to static list if HLS not ready
  const qualityOptions = levels.length > 0
    ? [{ label: 'AUTO', level: -1 }, ...levels.map((l, i) => ({ label: `${l.height || (i + 1) * 360}`, level: i }))]
    : QUALITIES;

  return (
    <div className="app">

      {/* ── Header ── */}
      <header className="header">
        <span className="header-title">USB002</span>
        <div className="header-meta">
          <span>FRED AGAIN.. × THOMAS BANGALTER</span>
          <span>ALEXANDRA PALACE, LONDON</span>
          <span>27 FEB 2026</span>
        </div>
      </header>

      {/* ── Player ── */}
      <section className="player-section">
        <div className="video-wrapper">
          {streamMissing ? (
            <div className="no-stream">
              <div className="no-stream-title">Stream not ready</div>
              <div>Place your WebM in <code>media/</code> and run:</div>
              <code>
                node transcode.js media/set.webm<br />
                npm start
              </code>
              <div style={{ marginTop: 12, color: '#1a1a1a', fontSize: 10 }}>
                Transcoding a 2h set takes ~20–40 min depending on CPU.
              </div>
            </div>
          ) : null}
          <VideoPlayer
            ref={playerRef}
            audioOnly={audioOnly}
            qualityLevel={qualityLevel}
            onLevelsReady={setLevels}
            onTimeUpdate={t => { setCurrentTime(t); setPlaying(true); }}
            onDurationReady={setDuration}
          />
        </div>

        {/* Now playing strip */}
        {activeTrack && (
          <div className="now-playing">
            <div className="np-number">{String(tracklist.findIndex(t => t.id === activeTrack.id) + 1).padStart(2, '0')}</div>
            <div className="np-info">
              <div className="np-title">
                {playing && <span className="live-dot" />}
                {activeTrack.title}
              </div>
              <div className="np-artist">{activeTrack.artist}</div>
              {activeTrack.note ? <div className="np-note">{activeTrack.note}</div> : null}
            </div>
          </div>
        )}
      </section>

      {/* ── Track list ── */}
      <aside className="tracklist-section">
        <TrackList
          tracks={tracklist}
          activeId={activeTrack?.id}
          onSelect={handleSelect}
        />
      </aside>

      {/* ── Controls bar ── */}
      <footer className="controls-bar">
        <div className="controls">

          {/* Progress bar */}
          <div className="progress-container">
            <div
              ref={progressRef}
              className="progress-track"
              onClick={handleProgressClick}
              onMouseMove={handleProgressMove}
              onMouseLeave={handleProgressLeave}
            >
              <div className="progress-fill" style={{ width: `${progressPct}%` }} />

              {/* Track markers */}
              <div className="progress-markers">
                {tracklist.map(track => {
                  const pct = (track.timestamp / (duration || TOTAL)) * 100;
                  return (
                    <div
                      key={track.id}
                      className={`progress-marker${track.id === activeTrack?.id ? ' active-marker' : ''}`}
                      style={{ left: `${pct}%` }}
                    />
                  );
                })}
              </div>

              {/* Hover tooltip */}
              {tooltipX !== null && (
                <div className="progress-tooltip" style={{ left: tooltipX }}>
                  {fmt(tooltipTime)}
                  {tooltipTrack ? ` — ${tooltipTrack.title}` : ''}
                </div>
              )}
            </div>
          </div>

          {/* Playback row */}
          <div className="controls-row">
            <button className="btn btn-skip" onClick={() => skipTrack(-1)} title="Shift+←">
              ⏮
            </button>
            <button className="btn btn-play" onClick={togglePlay} title="Space">
              {playing ? '⏸' : '▶'}
            </button>
            <button className="btn btn-skip" onClick={() => skipTrack(1)} title="Shift+→">
              ⏭
            </button>

            <div className="time-display">
              <span>{fmt(currentTime)}</span> / {fmt(duration || TOTAL)}
            </div>

            <div className="controls-right">
              {/* Volume */}
              <div className="volume-control">
                <button className="volume-btn" onClick={toggleMute} title="M">
                  {muted || volume === 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊'}
                </button>
                <input
                  type="range"
                  className="volume-slider"
                  min={0}
                  max={1}
                  step={0.02}
                  value={muted ? 0 : volume}
                  onChange={handleVolumeChange}
                />
              </div>

              {/* Quality */}
              <div className="quality-group">
                {qualityOptions.map(q => (
                  <button
                    key={q.level}
                    className={`quality-btn${qualityLevel === q.level ? ' active' : ''}`}
                    onClick={() => setQualityLevel(q.level)}
                  >
                    {q.label}
                  </button>
                ))}
              </div>

              {/* Audio-only toggle */}
              <button
                className={`mode-btn${audioOnly ? ' active' : ''}`}
                onClick={() => setAudioOnly(a => !a)}
              >
                {audioOnly ? '◉ AUDIO' : '◉ VIDEO'}
              </button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
