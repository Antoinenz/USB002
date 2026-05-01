export default function AudioPanel({ track, tracks }) {
  if (!track) return null;
  const idx = (tracks ?? []).findIndex(t => t.id === track.id);
  const total = (tracks ?? []).length;

  return (
    <div className="audio-panel">
      <div className="ap-bg-num" aria-hidden="true">
        {String(idx + 1).padStart(2, '0')}
      </div>
      <div className="ap-content">
        <div className="ap-meta">
          <span className="ap-num">{String(idx + 1).padStart(2, '0')}</span>
          <span className="ap-sep"> / </span>
          <span className="ap-total">{String(total).padStart(2, '0')}</span>
        </div>
        <div className="ap-title">{track.title}</div>
        <div className="ap-artist">{track.artist}</div>
        {track.note && <div className="ap-note">{track.note}</div>}
      </div>
    </div>
  );
}
