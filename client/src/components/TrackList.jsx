import { useEffect, useRef } from 'react';

function fmt(secs) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function TrackList({ tracks, activeId, onSelect }) {
  const activeRef = useRef(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [activeId]);

  return (
    <>
      <div className="tracklist-header">
        <span>Queue — {tracks.length} tracks</span>
        <span>1h56m23s</span>
      </div>

      {tracks.map((track, i) => {
        const isActive = track.id === activeId;
        return (
          <div
            key={track.id}
            ref={isActive ? activeRef : null}
            className={`track-item${isActive ? ' active' : ''}`}
            onClick={() => onSelect(track)}
          >
            <div className="track-num">{String(i + 1).padStart(2, '0')}</div>
            <div className="track-body">
              <div className="track-title">{track.title}</div>
              <div className="track-artist">{track.artist}</div>
              {track.note ? <div className="track-note">{track.note}</div> : null}
            </div>
            <div className="track-ts">{fmt(track.timestamp)}</div>
          </div>
        );
      })}
    </>
  );
}
