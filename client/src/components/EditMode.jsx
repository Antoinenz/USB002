import { useState } from 'react';

function fmtTs(secs) {
  const s = Math.max(0, Math.floor(secs));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

function parseTs(str) {
  const parts = str.split(':').map(p => parseInt(p, 10) || 0);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parseInt(str, 10) || 0;
}

export default function EditMode({ tracks, token, onSave, onClose, onTokenExpired }) {
  const [draft, setDraft] = useState(() =>
    tracks.map(t => ({ ...t, _ts: fmtTs(t.timestamp) }))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  function update(id, field, value) {
    setDraft(d => d.map(t => t.id === id ? { ...t, [field]: value } : t));
  }

  function updateTsDisplay(id, value) {
    setDraft(d => d.map(t => t.id === id ? { ...t, _ts: value } : t));
  }

  function commitTs(id) {
    setDraft(d => d.map(t => t.id === id ? { ...t, timestamp: parseTs(t._ts) } : t));
  }

  function move(idx, dir) {
    if (idx + dir < 0 || idx + dir >= draft.length) return;
    setDraft(d => {
      const next = [...d];
      [next[idx], next[idx + dir]] = [next[idx + dir], next[idx]];
      return next;
    });
  }

  function addTrack() {
    const maxId = Math.max(...draft.map(t => t.id), 0);
    const lastTs = draft.length > 0 ? draft[draft.length - 1].timestamp : 0;
    const newTs = lastTs + 30;
    setDraft(d => [...d, {
      id: maxId + 1, title: 'New Track', artist: '', album: '',
      timestamp: newTs, _ts: fmtTs(newTs), note: '',
    }]);
    setTimeout(() => {
      document.querySelector('.edit-list')?.scrollTo({ top: 999999, behavior: 'smooth' });
    }, 50);
  }

  function removeTrack(id) {
    if (draft.length <= 1) return;
    setDraft(d => d.filter(t => t.id !== id));
  }

  async function save() {
    setSaving(true);
    setError(null);
    const cleaned = draft.map((t, i) => ({
      id: i + 1,
      title: t.title || 'Untitled',
      artist: t.artist || '',
      ...(t.album ? { album: t.album } : {}),
      timestamp: t.timestamp,
      note: t.note || '',
    }));
    try {
      const r = await fetch('/api/tracklist', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-edit-token': token },
        body: JSON.stringify({ tracks: cleaned }),
      });
      if (r.status === 401) { onTokenExpired(); return; }
      if (!r.ok) { const j = await r.json(); throw new Error(j.error || 'Save failed'); }
      onSave(cleaned);
    } catch (e) {
      setError(e.message);
      setSaving(false);
    }
  }

  return (
    <div className="edit-overlay">
      <div className="edit-header">
        <span className="edit-title">EDIT QUEUE</span>
        {error && <span className="edit-error">{error}</span>}
        <div className="edit-actions">
          <button className="edit-btn" onClick={onClose} disabled={saving}>CANCEL</button>
          <button className="edit-btn edit-btn-save" onClick={save} disabled={saving}>
            {saving ? 'SAVING…' : 'SAVE'}
          </button>
        </div>
      </div>

      <div className="edit-col-header">
        <span className="ech-order">ORDER</span>
        <span className="ech-title">TITLE</span>
        <span className="ech-artist">ARTIST</span>
        <span className="ech-ts">TIMESTAMP</span>
        <span className="ech-note">NOTE</span>
        <span className="ech-del" />
      </div>

      <div className="edit-list">
        {draft.map((track, idx) => (
          <div key={track.id} className="edit-track">
            <div className="edit-order">
              <button className="edit-order-btn" onClick={() => move(idx, -1)} disabled={idx === 0} title="Move up">▲</button>
              <span className="edit-idx">{String(idx + 1).padStart(2, '0')}</span>
              <button className="edit-order-btn" onClick={() => move(idx, 1)} disabled={idx === draft.length - 1} title="Move down">▼</button>
            </div>
            <input className="edit-input ei-title" value={track.title}
              onChange={e => update(track.id, 'title', e.target.value)} placeholder="Title" />
            <input className="edit-input ei-artist" value={track.artist}
              onChange={e => update(track.id, 'artist', e.target.value)} placeholder="Artist" />
            <input className="edit-input ei-ts" value={track._ts}
              onChange={e => updateTsDisplay(track.id, e.target.value)}
              onBlur={() => commitTs(track.id)}
              placeholder="0:00:00" title="H:MM:SS" />
            <input className="edit-input ei-note" value={track.note ?? ''}
              onChange={e => update(track.id, 'note', e.target.value)} placeholder="Note (optional)" />
            <button className="edit-del-btn" onClick={() => removeTrack(track.id)} title="Remove track" disabled={draft.length <= 1}>✕</button>
          </div>
        ))}
      </div>

      <div className="edit-footer">
        <button className="edit-add-btn" onClick={addTrack}>+ ADD TRACK</button>
      </div>
    </div>
  );
}
