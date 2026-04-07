import React, { useState, useCallback, useRef, useEffect } from 'react';
import { cn } from '../../lib/utils';
import { AlertTriangle, Play, Pause, Volume2, VolumeX, Music, Film } from 'lucide-react';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface MediaPreviewProps {
  /** Absolute file path of the media file. */
  filePath: string;
  /** Whether running inside Tauri (to use asset protocol). */
  isTauri: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Media type derived from file extension. */
type MediaType = 'video' | 'audio' | 'unknown';

/** Well-supported extensions that HTML5 can play natively. */
const BROWSER_SUPPORTED_VIDEO = new Set(['mp4', 'webm', 'ogg', 'mov']);
const BROWSER_SUPPORTED_AUDIO = new Set(['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a']);

function getMediaType(filePath: string): MediaType {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  if (BROWSER_SUPPORTED_VIDEO.has(ext)) return 'video';
  if (BROWSER_SUPPORTED_AUDIO.has(ext)) return 'audio';
  // Known media but possibly unsupported
  if (['avi', 'mkv'].includes(ext)) return 'unknown';
  if (['wma', 'opus', 'mid', 'midi'].includes(ext)) return 'unknown';
  return 'unknown';
}

function isVideoExt(ext: string): boolean {
  return ['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext);
}

/** Format seconds to mm:ss or h:mm:ss. */
function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Slider helper — maps click position on a div to a 0-1 ratio
// ---------------------------------------------------------------------------
function getClickRatio(e: React.MouseEvent<HTMLDivElement>, el: HTMLDivElement | null): number {
  if (!el) return 0;
  const rect = el.getBoundingClientRect();
  const x = e.clientX - rect.left;
  return Math.max(0, Math.min(1, x / rect.width));
}

// ---------------------------------------------------------------------------
// MediaPreview component — plays video/audio files in the editor area
// ---------------------------------------------------------------------------

export const MediaPreview: React.FC<MediaPreviewProps> = ({ filePath, isTauri }) => {
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const volumeRef = useRef<HTMLDivElement>(null);

  const [mediaUrl, setMediaUrl] = useState<string>('');
  const [mediaType, setMediaType] = useState<MediaType>('video');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  const fileName = filePath.split('/').pop() ?? filePath;
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  const isVideo = isVideoExt(ext);

  // -------------------------------------------------------------------------
  // Load media — convert file path to Tauri asset URL
  // -------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    async function loadMedia() {
      setLoading(true);
      setError(null);

      const type = getMediaType(filePath);
      setMediaType(type);

      if (!isTauri) {
        setError('Media playback is only available in Tauri desktop mode.');
        setLoading(false);
        return;
      }

      if (type === 'unknown') {
        setError('This media format is not supported for in-editor playback.');
        setLoading(false);
        return;
      }

      try {
        // Use Tauri's convertFileSrc to convert local path to asset protocol URL
        const { convertFileSrc } = await import('@tauri-apps/api/core');
        const assetUrl = convertFileSrc(filePath);
        if (cancelled) return;
        setMediaUrl(assetUrl);
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.toString() ?? 'Failed to load media file');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadMedia();

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [filePath, isTauri]);

  // -------------------------------------------------------------------------
  // Media event handlers
  // -------------------------------------------------------------------------
  const handleLoadedMetadata = useCallback(() => {
    if (mediaRef.current) {
      setDuration(mediaRef.current.duration);
      setVolume(mediaRef.current.volume);
    }
  }, []);

  const handleTimeUpdate = useCallback(() => {
    if (mediaRef.current) {
      setCurrentTime(mediaRef.current.currentTime);
    }
  }, []);

  const handlePlay = useCallback(() => setIsPlaying(true), []);
  const handlePause = useCallback(() => setIsPlaying(false), []);
  const handleEnded = useCallback(() => setIsPlaying(false), []);
  const handleMediaError = useCallback(() => {
    setError('Failed to play media. The format may not be supported by your browser.');
  }, []);

  // -------------------------------------------------------------------------
  // Controls
  // -------------------------------------------------------------------------
  const togglePlay = useCallback(() => {
    if (!mediaRef.current) return;
    if (mediaRef.current.paused) {
      mediaRef.current.play();
    } else {
      mediaRef.current.pause();
    }
  }, []);

  const seekTo = useCallback((ratio: number) => {
    if (!mediaRef.current || !isFinite(duration)) return;
    mediaRef.current.currentTime = ratio * duration;
  }, [duration]);

  const setMediaVolume = useCallback((vol: number) => {
    if (!mediaRef.current) return;
    const v = Math.max(0, Math.min(1, vol));
    mediaRef.current.volume = v;
    setVolume(v);
    if (v === 0) {
      setIsMuted(true);
      mediaRef.current.muted = true;
    } else if (isMuted) {
      setIsMuted(false);
      mediaRef.current.muted = false;
    }
  }, [isMuted]);

  const toggleMute = useCallback(() => {
    if (!mediaRef.current) return;
    const nextMuted = !isMuted;
    mediaRef.current.muted = nextMuted;
    setIsMuted(nextMuted);
  }, [isMuted]);

  // -------------------------------------------------------------------------
  // Progress bar click
  // -------------------------------------------------------------------------
  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const ratio = getClickRatio(e, progressRef.current);
    seekTo(ratio);
  }, [seekTo]);

  // -------------------------------------------------------------------------
  // Volume bar click
  // -------------------------------------------------------------------------
  const handleVolumeClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const ratio = getClickRatio(e, volumeRef.current);
    setMediaVolume(ratio);
  }, [setMediaVolume]);

  // -------------------------------------------------------------------------
  // Keyboard shortcuts
  // -------------------------------------------------------------------------
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore if focus is in an input field
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;

      if (e.key === ' ') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (mediaRef.current) {
          mediaRef.current.currentTime = Math.max(0, mediaRef.current.currentTime - 5);
        }
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (mediaRef.current && isFinite(duration)) {
          mediaRef.current.currentTime = Math.min(duration, mediaRef.current.currentTime + 5);
        }
      } else if (e.key === 'm' || e.key === 'M') {
        toggleMute();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [togglePlay, toggleMute, duration]);

  // -------------------------------------------------------------------------
  // Computed values
  // -------------------------------------------------------------------------
  const progress = isFinite(duration) && duration > 0 ? currentTime / duration : 0;

  // -------------------------------------------------------------------------
  // Render: Loading state
  // -------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-surface-container-lowest gap-4">
        <div className="relative w-8 h-8">
          <div className="absolute inset-0 rounded-full border-2 border-[var(--t-editor-spinner-track)] border-t-[var(--t-editor-spinner-bar)] animate-spin" />
        </div>
        <p className="text-[10px] text-outline uppercase tracking-widest">Loading media...</p>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Render: Error / unsupported state
  // -------------------------------------------------------------------------
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-surface-container-lowest gap-4">
        <AlertTriangle size={32} className="text-error/60" />
        <div className="flex flex-col items-center gap-1 text-center max-w-sm">
          <p className="text-xs text-error font-medium">{error}</p>
          <p className="text-[10px] text-outline">{fileName}</p>
          {mediaType === 'unknown' && (
            <p className="text-[10px] text-outline mt-1">
              Try opening this file with an external player.
            </p>
          )}
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Render: Media player
  // -------------------------------------------------------------------------
  return (
    <div
      ref={containerRef}
      className="flex flex-col h-full bg-surface-container-lowest overflow-hidden"
    >
      {/* Toolbar: file info */}
      <div className="flex items-center gap-2 px-4 py-2 bg-surface-container-low border-b border-outline-variant/10 shrink-0">
        {isVideo ? (
          <Film size={14} className="text-secondary shrink-0" />
        ) : (
          <Music size={14} className="text-secondary shrink-0" />
        )}
        <span className="text-[10px] text-on-surface-variant font-mono truncate">
          {fileName}
        </span>
        <span className="ml-auto text-[10px] text-outline font-mono">
          {isVideo ? 'VIDEO' : 'AUDIO'}
        </span>
      </div>

      {/* Media display area */}
      <div className="flex-1 flex items-center justify-center overflow-hidden relative">
        {mediaType === 'video' ? (
          <video
            ref={mediaRef as React.RefObject<HTMLVideoElement>}
            src={mediaUrl}
            onLoadedMetadata={handleLoadedMetadata}
            onTimeUpdate={handleTimeUpdate}
            onPlay={handlePlay}
            onPause={handlePause}
            onEnded={handleEnded}
            onError={handleMediaError}
            onClick={togglePlay}
            className="max-w-full max-h-full object-contain cursor-pointer"
            preload="metadata"
          />
        ) : (
          /* Audio: show visual placeholder with waveform-style graphic */
          <div className="flex flex-col items-center justify-center gap-6 w-full h-full py-8">
            <div className="w-32 h-32 rounded-full bg-surface-container-high flex items-center justify-center">
              <Music size={48} className="text-secondary/60" />
            </div>
            <p className="text-sm text-on-surface-variant font-medium truncate max-w-[300px]">
              {fileName}
            </p>
            <audio
              ref={mediaRef as React.RefObject<HTMLAudioElement>}
              src={mediaUrl}
              onLoadedMetadata={handleLoadedMetadata}
              onTimeUpdate={handleTimeUpdate}
              onPlay={handlePlay}
              onPause={handlePause}
              onEnded={handleEnded}
              onError={handleMediaError}
              preload="metadata"
            />
          </div>
        )}
      </div>

      {/* Custom control bar */}
      <div className="flex items-center gap-3 px-4 py-2 bg-surface-container-low border-t border-outline-variant/10 shrink-0">
        {/* Play / Pause */}
        <button
          onClick={togglePlay}
          className="p-1 hover:bg-surface-container-high rounded transition-colors text-on-surface-variant hover:text-on-surface"
          title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
        >
          {isPlaying ? <Pause size={16} /> : <Play size={16} />}
        </button>

        {/* Time display */}
        <span className="text-[10px] font-mono text-on-surface-variant min-w-[80px]">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>

        {/* Progress bar */}
        <div
          ref={progressRef}
          onClick={handleProgressClick}
          className="flex-1 h-1.5 bg-surface-container-highest rounded-full cursor-pointer group relative"
        >
          {/* Buffered track visual (no actual buffered data, just styling) */}
          <div
            className="absolute inset-y-0 left-0 bg-primary/30 rounded-full"
            style={{ width: `${progress * 100}%` }}
          />
          <div
            className="absolute inset-y-0 left-0 bg-primary rounded-full transition-[width] duration-100"
            style={{ width: `${progress * 100}%` }}
          />
          {/* Thumb */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-primary rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ left: `calc(${progress * 100}% - 6px)` }}
          />
        </div>

        {/* Volume */}
        <button
          onClick={toggleMute}
          className="p-1 hover:bg-surface-container-high rounded transition-colors text-on-surface-variant hover:text-on-surface"
          title="Mute (M)"
        >
          {isMuted || volume === 0 ? <VolumeX size={14} /> : <Volume2 size={14} />}
        </button>
        <div
          ref={volumeRef}
          onClick={handleVolumeClick}
          className="w-16 h-1.5 bg-surface-container-highest rounded-full cursor-pointer relative"
        >
          <div
            className="absolute inset-y-0 left-0 bg-on-surface-variant rounded-full"
            style={{ width: `${(isMuted ? 0 : volume) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
};

export default MediaPreview;
