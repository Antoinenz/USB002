import { useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import Hls from 'hls.js';

const VideoPlayer = forwardRef(function VideoPlayer(
  { audioOnly, qualityLevel, onLevelsReady, onTimeUpdate, onDurationReady, onPlay, onPause },
  ref
) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);

  useImperativeHandle(ref, () => ({
    seek(seconds) {
      if (videoRef.current) {
        videoRef.current.currentTime = seconds;
        videoRef.current.play().catch(() => {});
      }
    },
    play() { videoRef.current?.play().catch(() => {}); },
    pause() { videoRef.current?.pause(); },
    get paused() { return videoRef.current?.paused ?? true; },
    get currentTime() { return videoRef.current?.currentTime ?? 0; },
    get duration() { return videoRef.current?.duration ?? 0; },
    setVolume(v) { if (videoRef.current) videoRef.current.volume = v; },
    setMuted(m) { if (videoRef.current) videoRef.current.muted = m; },
  }));

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const src = audioOnly ? '/stream/audio/playlist.m3u8' : '/stream/master.m3u8';
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    if (Hls.isSupported()) {
      const hls = new Hls({ startLevel: -1, autoStartLoad: true, capLevelToPlayerSize: true, maxMaxBufferLength: 60 });
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => { onLevelsReady?.(data.levels); });
      hls.on(Hls.Events.ERROR, (_, data) => { if (data.fatal) console.error('HLS fatal error:', data.type, data.details); });
      return () => hls.destroy();
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
    }
  }, [audioOnly]);

  useEffect(() => {
    if (hlsRef.current) hlsRef.current.currentLevel = qualityLevel;
  }, [qualityLevel]);

  return (
    <video
      ref={videoRef}
      onTimeUpdate={() => onTimeUpdate?.(videoRef.current?.currentTime ?? 0)}
      onLoadedMetadata={() => onDurationReady?.(videoRef.current?.duration ?? 0)}
      onPlay={() => onPlay?.()}
      onPause={() => onPause?.()}
      onEnded={() => onPause?.()}
      playsInline
    />
  );
});

export default VideoPlayer;
