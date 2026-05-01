import { useState, useEffect, useRef, useCallback } from 'react';
import VideoPlayer from './components/VideoPlayer.jsx';
import TrackList from './components/TrackList.jsx';
import AudioPanel from './components/AudioPanel.jsx';
import EditMode from './components/EditMode.jsx';
import fallbackTracks from './data/tracklist.json';

const TOTAL = 6983;

function fmt(secs) {
  if (!secs || isNaN(secs)) return '0:00:00';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function getActiveTrack(currentTime, tracks) {
  let active = tracks[0];
  let bestTs = -1;
  for (const track of tracks) {
    if (track.timestamp <= currentTime && track.timestamp > bestTs) {
      bestTs = track.timestamp;
      active = track;
    }
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

function AuthModal({ onClose, onSuccess }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const r = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Authentication failed');
      onSuccess(data.token);
    } catch (e) {
      setError(e.message);
      setLoading(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">EDIT MODE</div>
        <form onSubmit={handleSubmit}>
          <input
            className="modal-input"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="PASSWORD"
            autoFocus
          />
          {error && <div className="modal-error">{error}</div>}
          <div className="modal-btns">
            <button type="button" className="edit-btn" onClick={onClose}>CANCEL</button>
            <button type="submit" className="edit-btn edit-btn-save" disabled={loading}>
              {loading ? '…' : 'UNLOCK'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function App() {
  const playerRef = useRef(null);
  const progressRef = useRef(null);
  const pendingSeekRef = useRef(null);
  const mouseDragging = useRef(false);

  const [tracks, setTracks] = useState(fallbackTracks);
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

  // Edit mode
  const [editEnabled, setEditEnabled] = useState(false);
  const [editToken, setEditToken] = useState(() => sessionStorage.getItem('usb002-edit-token') || null);
  const [showAuth, setShowAuth] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const activeTrack = getActiveTrack(currentTime, tracks);

  // Fetch updated tracklist from server (overrides bundled JSON after edits)
  useEffect(() => {
    fetch('/api/tracklist').then(r => r.json()).then(setTracks).catch(() => {});
  }, []);

  // Check if edit mode is available
  useEffect(() => {
    fetch('/api/edit-status').then(r => { if (r.ok) setEditEnabled(true); }).catch(() => {});
  }, []);

  // Check if stream exists
  useEffect(() => {
    fetch('/stream/master.m3u8').then(r => setStreamMissing(!r.ok)).catch(() => setStreamMissing(true));
  }, []);

  // Restore saved position on initial load
  useEffect(() => {
    const saved = parseFloat(localStorage.getItem('usb002-pos') || '0');
    if (saved > 5) pendingSeekRef.current = saved;
  }, []);

  // Periodically save position to localStorage
  useEffect(() => {
    const id = setInterval(() => {
      if (currentTime > 5) localStorage.setItem('usb002-pos', String(Math.floor(currentTime)));
    }, 5000);
    return () => clearInterval(id);
  }, [currentTime]);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKey(e) {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || editOpen) return;
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
  }, [playing, duration, editOpen]);

  // Global mouseup for drag release outside progress bar
  useEffect(() => {
    function onMouseUp() { mouseDragging.current = false; }
    window.addEventListener('mouseup', onMouseUp);
    return () => window.removeEventListener('mouseup', onMouseUp);
  }, []);

  const togglePlay = useCallback(() => {
    const p = playerRef.current;
    if (!p) return;
    if (p.paused) { p.play(); } else { p.pause(); }
  }, []);

  const toggleMute = useCallback(() => {
    const next = !muted;
    setMuted(next);
    playerRef.current?.setMuted(next);
  }, [muted]);

  function handleDurationReady(d) {
    setDuration(d);
    if (pendingSeekRef.current != null && pendingSeekRef.current > 0) {
      const t = pendingSeekRef.current;
      pendingSeekRef.current = null;
      setTimeout(() => playerRef.current?.seek(t), 250);
    }
  }

  function handleAudioToggle() {
    pendingSeekRef.current = playerRef.current?.currentTime ?? 0;
    setAudioOnly(a => !a);
  }

  function handleSelect(track) {
    playerRef.current?.seek(track.timestamp);
    playerRef.current?.play().catch(() => {});
  }

  function skipTrack(dir) {
    const idx = tracks.findIndex(t => t.id === activeTrack?.id);
    const next = tracks[idx + dir];
    if (next) handleSelect(next);
  }

  function handleVolumeChange(e) {
    const v = parseFloat(e.target.value);
    setVolume(v);
    playerRef.current?.setVolume(v);
    if (v > 0 && muted) { setMuted(false); playerRef.current?.setMuted(false); }
  }

  // Progress bar — shared position calculator
  function positionFromClient(clientX) {
    const rect = progressRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    const frac = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return frac * (duration || TOTAL);
  }

  function seekTo(t) {
    playerRef.current?.seek(t);
    setCurrentTime(t);
  }

  // Mouse events
  function handleMouseDown(e) {
    mouseDragging.current = true;
    seekTo(positionFromClient(e.clientX));
  }

  function handleMouseMove(e) {
    const t = positionFromClient(e.clientX);
    const rect = progressRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    setTooltipX(x);
    setTooltipTime(t);
    setTooltipTrack(getActiveTrack(t, tracks));
    if (mouseDragging.current) seekTo(t);
  }

  function handleMouseLeave() {
    setTooltipX(null);
    setTooltipTime(null);
    setTooltipTrack(null);
  }

  // Touch events
  function handleTouchStart(e) {
    e.preventDefault();
    seekTo(positionFromClient(e.touches[0].clientX));
  }

  function handleTouchMove(e) {
    e.preventDefault();
    seekTo(positionFromClient(e.touches[0].clientX));
  }

  const progressPct = ((currentTime / (duration || TOTAL)) * 100).toFixed(3);

  const qualityOptions = levels.length > 0
    ? [{ label: 'AUTO', level: -1 }, ...levels.map((l, i) => ({ label: `${l.height || '?'}`, level: i }))]
    : QUALITIES;

  // Edit mode handlers
  function handleEditClick() {
    if (editToken) setEditOpen(true);
    else setShowAuth(true);
  }

  function handleAuthSuccess(token) {
    setEditToken(token);
    sessionStorage.setItem('usb002-edit-token', token);
    setShowAuth(false);
    setEditOpen(true);
  }

  function handleEditSave(newTracks) {
    setTracks(newTracks);
    setEditOpen(false);
  }

  function handleTokenExpired() {
    setEditToken(null);
    sessionStorage.removeItem('usb002-edit-token');
    setEditOpen(false);
    setShowAuth(true);
  }

  return (
    <div className="app">
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} onSuccess={handleAuthSuccess} />}
      {editOpen && (
        <EditMode
          tracks={tracks}
          token={editToken}
          onSave={handleEditSave}
          onClose={() => setEditOpen(false)}
          onTokenExpired={handleTokenExpired}
        />
      )}

      {/* ── Header ── */}
      <header className="header">
        <span className="header-title">USB002</span>
        <div className="header-meta">
          <span>FRED AGAIN.. × THOMAS BANGALTER</span>
          <span className="header-meta-hide">ALEXANDRA PALACE, LONDON</span>
          <span className="header-meta-hide">27 FEB 2026</span>
        </div>
        {editEnabled && (
          <button className="header-edit-btn" onClick={handleEditClick}>EDIT</button>
        )}
      </header>

      {/* ── Player ── */}
      <section className="player-section">
        <div className={`video-wrapper${audioOnly ? ' audio-mode' : ''}`}>
          {streamMissing && (
            <div className="no-stream">
              <div className="no-stream-title">Stream not ready</div>
              <div>Place your WebM in <code>media/</code> and run:</div>
              <code>node transcode.js media/set.webm<br />npm start</code>
            </div>
          )}
          <VideoPlayer
            ref={playerRef}
            audioOnly={audioOnly}
            qualityLevel={qualityLevel}
            onLevelsReady={setLevels}
            onTimeUpdate={setCurrentTime}
            onDurationReady={handleDurationReady}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
          />
          {audioOnly && <AudioPanel track={activeTrack} tracks={tracks} />}
        </div>

        {/* Now playing strip — hidden in audio mode (AudioPanel handles it) */}
        {activeTrack && !audioOnly && (
          <div className="now-playing">
            <div className="np-number">{String(tracks.findIndex(t => t.id === activeTrack.id) + 1).padStart(2, '0')}</div>
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
        <TrackList tracks={tracks} activeId={activeTrack?.id} onSelect={handleSelect} />
      </aside>

      {/* ── Controls bar ── */}
      <footer className="controls-bar">
        <div className="controls">
          {/* Progress bar — large hitbox container */}
          <div
            ref={progressRef}
            className="progress-container"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
          >
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${progressPct}%` }} />
              <div className="progress-markers">
                {tracks.map(track => {
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
              {tooltipX !== null && (
                <div className="progress-tooltip" style={{ left: tooltipX }}>
                  {fmt(tooltipTime)}{tooltipTrack ? ` — ${tooltipTrack.title}` : ''}
                </div>
              )}
            </div>
          </div>

          {/* Playback row */}
          <div className="controls-row">
            <button className="btn btn-skip" onClick={() => skipTrack(-1)} title="Shift+←">⏮</button>
            <button className="btn btn-play" onClick={togglePlay} title="Space">
              {playing ? '⏸' : '▶'}
            </button>
            <button className="btn btn-skip" onClick={() => skipTrack(1)} title="Shift+→">⏭</button>

            <div className="time-display">
              <span>{fmt(currentTime)}</span> / {fmt(duration || TOTAL)}
            </div>

            <div className="controls-right">
              <div className="volume-control">
                <button className="volume-btn" onClick={toggleMute} title="M">
                  {muted || volume === 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊'}
                </button>
                <input type="range" className="volume-slider" min={0} max={1} step={0.02}
                  value={muted ? 0 : volume} onChange={handleVolumeChange} />
              </div>

              <div className="quality-group">
                {qualityOptions.map(q => (
                  <button key={q.level}
                    className={`quality-btn${qualityLevel === q.level ? ' active' : ''}`}
                    onClick={() => setQualityLevel(q.level)}>{q.label}</button>
                ))}
              </div>

              <button className={`mode-btn${audioOnly ? ' active' : ''}`} onClick={handleAudioToggle}>
                {audioOnly ? '◉ AUDIO' : '◉ VIDEO'}
              </button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
