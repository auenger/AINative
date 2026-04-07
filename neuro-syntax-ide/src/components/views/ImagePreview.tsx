import React, { useState, useCallback, useRef, useEffect } from 'react';
import { cn } from '../../lib/utils';
import { useTheme } from '../../context/ThemeContext';
import { AlertTriangle, ZoomIn, ZoomOut, RotateCcw, Info, X } from 'lucide-react';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ImagePreviewProps {
  /** Absolute file path of the image. */
  filePath: string;
  /** Whether running inside Tauri (to use invoke for file read). */
  isTauri: boolean;
}

// ---------------------------------------------------------------------------
// Image metadata
// ---------------------------------------------------------------------------

interface ImageMeta {
  width: number;
  height: number;
  /** Human-readable file size string. */
  fileSize: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// ---------------------------------------------------------------------------
// EXIF data types from Tauri backend (feat-file-preview-image-enhance)
// ---------------------------------------------------------------------------

interface ExifData {
  camera_make?: string;
  camera_model?: string;
  lens_model?: string;
  f_number?: string;
  exposure_time?: string;
  iso?: number;
  focal_length?: string;
  date_time_original?: string;
  software?: string;
  orientation?: string;
  gps?: { latitude: number; longitude: number; altitude?: number };
}

interface BackendImageMetadata {
  width: number;
  height: number;
  file_size: number;
  file_size_str: string;
  format: string;
  mime_type: string;
  bit_depth: number | null;
  color_space: string;
  exif?: ExifData;
}

// ---------------------------------------------------------------------------
// Extended MIME map for additional image formats
// ---------------------------------------------------------------------------

function getMimeType(ext: string, fallbackMime?: string): string {
  const mimeMap: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    jfif: 'image/jpeg',
    pjpeg: 'image/jpeg',
    pjp: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    bmp: 'image/bmp',
    ico: 'image/x-icon',
    avif: 'image/avif',
    heic: 'image/heic',
    heif: 'image/heif',
    tiff: 'image/tiff',
    tif: 'image/tiff',
    svg: 'image/svg+xml',
  };
  return mimeMap[ext] ?? fallbackMime ?? 'application/octet-stream';
}

// ---------------------------------------------------------------------------
// MetadataPanel — collapsible EXIF/info sidebar
// ---------------------------------------------------------------------------

const MetadataPanel: React.FC<{
  metadata: BackendImageMetadata;
  onClose: () => void;
}> = ({ metadata, onClose }) => {
  const metaRow = (label: string, value: string | number | null | undefined) => {
    if (value == null || value === '') return null;
    return (
      <div className="flex justify-between items-center px-1 py-0.5">
        <span className="text-[10px] text-on-surface-variant uppercase tracking-widest">{label}</span>
        <span className="text-[11px] text-on-surface font-mono">{String(value)}</span>
      </div>
    );
  };

  const exif = metadata.exif;

  return (
    <div className="w-64 shrink-0 border-l border-outline-variant/10 bg-surface-container-low overflow-y-auto p-3 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-on-surface font-medium uppercase tracking-widest">Image Info</span>
        <button onClick={onClose} className="p-1 hover:bg-surface-container-high rounded text-on-surface-variant hover:text-on-surface transition-colors">
          <X size={12} />
        </button>
      </div>

      {/* Basic info section */}
      <div className="space-y-1">
        <span className="text-[10px] text-outline font-medium uppercase tracking-widest">General</span>
        {metaRow('Dimensions', `${metadata.width} x ${metadata.height}`)}
        {metaRow('File Size', metadata.file_size_str || formatFileSize(metadata.file_size))}
        {metaRow('Format', metadata.format.toUpperCase())}
        {metaRow('MIME Type', metadata.mime_type)}
        {metaRow('Bit Depth', metadata.bit_depth != null ? `${metadata.bit_depth}-bit` : null)}
        {metaRow('Color Space', metadata.color_space !== 'Unknown' ? metadata.color_space : null)}
      </div>

      {/* EXIF section */}
      {exif && (
        <div className="space-y-1">
          <span className="text-[10px] text-outline font-medium uppercase tracking-widest">EXIF</span>
          {metaRow('Camera', [exif.camera_make, exif.camera_model].filter(Boolean).join(' ') || null)}
          {metaRow('Lens', exif.lens_model)}
          {metaRow('Aperture', exif.f_number)}
          {metaRow('Shutter', exif.exposure_time)}
          {metaRow('ISO', exif.iso != null ? `ISO ${exif.iso}` : null)}
          {metaRow('Focal Length', exif.focal_length)}
          {metaRow('Taken', exif.date_time_original)}
          {metaRow('Software', exif.software)}
          {metaRow('Orientation', exif.orientation)}
          {exif.gps && metaRow('GPS', `${exif.gps.latitude.toFixed(4)}, ${exif.gps.longitude.toFixed(4)}`)}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// SVG sanitization — strip dangerous elements/attributes
// ---------------------------------------------------------------------------

function sanitizeSvg(svgText: string): string {
  // Remove script tags and their contents
  let clean = svgText.replace(/<script[\s\S]*?<\/script\s*>/gi, '');
  // Remove event handler attributes (on*)
  clean = clean.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  // Remove javascript: URLs
  clean = clean.replace(/href\s*=\s*["']javascript:[^"']*["']/gi, 'href="#"');
  clean = clean.replace(/xlink:href\s*=\s*["']javascript:[^"']*["']/gi, 'xlink:href="#"');
  return clean;
}

// ---------------------------------------------------------------------------
// ImagePreview component — handles PNG/JPG/GIF/WebP/BMP/ICO/AVIF + extended formats
// ---------------------------------------------------------------------------

export const ImagePreview: React.FC<ImagePreviewProps> = ({ filePath, isTauri }) => {
  const { theme: appTheme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);

  const [imgSrc, setImgSrc] = useState<string>('');
  const [meta, setMeta] = useState<ImageMeta | null>(null);
  const [imageMeta, setImageMeta] = useState<BackendImageMetadata | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [showInfoPanel, setShowInfoPanel] = useState(false);

  // Determine file extension
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  const isSvg = ext === 'svg';

  // -------------------------------------------------------------------------
  // Load image file
  // -------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    async function loadImage() {
      setLoading(true);
      setError(null);

      try {
        if (isTauri) {
          const { invoke } = await import('@tauri-apps/api/core');

          if (isSvg) {
            // Read SVG as text for sanitization
            const svgText = await invoke<string>('read_file', { path: filePath });
            if (cancelled) return;
            const sanitized = sanitizeSvg(svgText);
            const blob = new Blob([sanitized], { type: 'image/svg+xml' });
            setImgSrc(URL.createObjectURL(blob));
          } else {
            // Read binary image as base64
            const base64 = await invoke<string>('read_file_base64', { path: filePath });
            if (cancelled) return;
            const mime = getMimeType(ext);
            setImgSrc(`data:${mime};base64,${base64}`);
          }
        } else {
          // Dev/mock mode — generate a placeholder
          setImgSrc('');
          setError('Image preview is only available in Tauri desktop mode.');
          setLoading(false);
          return;
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.toString() ?? 'Failed to load image');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadImage();

    return () => {
      cancelled = true;
      // Revoke object URL to avoid memory leaks
      if (imgSrc.startsWith('blob:')) {
        URL.revokeObjectURL(imgSrc);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filePath, isTauri]);

  // -------------------------------------------------------------------------
  // Load image metadata from Tauri backend (feat-file-preview-image-enhance)
  // -------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    async function loadMetadata() {
      if (!isTauri) return;
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const result = await invoke<BackendImageMetadata>('read_image_meta', { path: filePath });
        if (cancelled) return;
        setImageMeta(result);
      } catch (err: any) {
        // Metadata loading failure should not block image rendering
        console.warn('Failed to load image metadata:', err);
      }
    }

    loadMetadata();

    return () => {
      cancelled = true;
    };
  }, [filePath, isTauri]);

  // -------------------------------------------------------------------------
  // Image load handler — capture natural dimensions & compute zoom-to-fit
  // -------------------------------------------------------------------------
  const handleImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    setNaturalSize({ w, h });

    // Compute zoom-to-fit
    if (containerRef.current) {
      const containerW = containerRef.current.clientWidth - 48; // padding
      const containerH = containerRef.current.clientHeight - 80; // padding + info bar
      if (containerW > 0 && containerH > 0 && w > 0 && h > 0) {
        const scaleW = containerW / w;
        const scaleH = containerH / h;
        const fitScale = Math.min(scaleW, scaleH, 1); // don't upscale beyond 100%
        setZoom(fitScale);
      }
    }

    setMeta({
      width: w,
      height: h,
      fileSize: imageMeta?.file_size_str ?? '',
    });
  }, [imageMeta]);

  // -------------------------------------------------------------------------
  // Mouse wheel zoom
  // -------------------------------------------------------------------------
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom(prev => {
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      return Math.min(5, Math.max(0.1, prev + delta));
    });
  }, []);

  // -------------------------------------------------------------------------
  // Zoom controls
  // -------------------------------------------------------------------------
  const zoomIn = useCallback(() => setZoom(prev => Math.min(5, prev + 0.25)), []);
  const zoomOut = useCallback(() => setZoom(prev => Math.max(0.1, prev - 0.25)), []);
  const zoomReset = useCallback(() => {
    if (naturalSize && containerRef.current) {
      const containerW = containerRef.current.clientWidth - 48;
      const containerH = containerRef.current.clientHeight - 80;
      const scaleW = containerW / naturalSize.w;
      const scaleH = containerH / naturalSize.h;
      setZoom(Math.min(scaleW, scaleH, 1));
    } else {
      setZoom(1);
    }
  }, [naturalSize]);

  // -------------------------------------------------------------------------
  // Keyboard shortcuts for zoom + info toggle
  // -------------------------------------------------------------------------
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '=') {
        e.preventDefault();
        zoomIn();
      } else if ((e.metaKey || e.ctrlKey) && e.key === '-') {
        e.preventDefault();
        zoomOut();
      } else if ((e.metaKey || e.ctrlKey) && e.key === '0') {
        e.preventDefault();
        zoomReset();
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'i') {
        e.preventDefault();
        setShowInfoPanel(prev => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [zoomIn, zoomOut, zoomReset]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-surface-container-lowest gap-4">
        <div className="relative w-8 h-8">
          <div className="absolute inset-0 rounded-full border-2 border-[var(--t-editor-spinner-track)] border-t-[var(--t-editor-spinner-bar)] animate-spin" />
        </div>
        <p className="text-[10px] text-outline uppercase tracking-widest">Loading image...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-surface-container-lowest gap-4">
        <AlertTriangle size={32} className="text-error/60" />
        <div className="flex flex-col items-center gap-1 text-center max-w-sm">
          <p className="text-xs text-error font-medium">{error}</p>
          <p className="text-[10px] text-outline">{filePath.split('/').pop()}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex flex-col h-full bg-surface-container-lowest overflow-hidden"
    >
      {/* Zoom toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 bg-surface-container-low border-b border-outline-variant/10 shrink-0">
        <button
          onClick={zoomOut}
          className="p-1 hover:bg-surface-container-high rounded transition-colors text-on-surface-variant hover:text-on-surface"
          title="Zoom Out (Cmd+-)"
        >
          <ZoomOut size={14} />
        </button>
        <span className="text-[10px] font-mono text-on-surface-variant min-w-[48px] text-center">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={zoomIn}
          className="p-1 hover:bg-surface-container-high rounded transition-colors text-on-surface-variant hover:text-on-surface"
          title="Zoom In (Cmd+=)"
        >
          <ZoomIn size={14} />
        </button>
        <button
          onClick={zoomReset}
          className="p-1 hover:bg-surface-container-high rounded transition-colors text-on-surface-variant hover:text-on-surface"
          title="Fit to View (Cmd+0)"
        >
          <RotateCcw size={14} />
        </button>
        <button
          onClick={() => setShowInfoPanel(prev => !prev)}
          className={cn(
            'p-1 hover:bg-surface-container-high rounded transition-colors text-on-surface-variant hover:text-on-surface',
            showInfoPanel && 'bg-surface-container-high text-on-surface',
          )}
          title="Image Info (Cmd+I)"
        >
          <Info size={14} />
        </button>
        {meta && (
          <span className="ml-auto text-[10px] text-outline font-mono">
            {meta.width} x {meta.height}
          </span>
        )}
      </div>

      {/* Image display area with checkerboard background */}
      <div className="flex flex-1 overflow-hidden">
        <div
          className="flex-1 overflow-auto flex items-center justify-center"
          onWheel={handleWheel}
          style={{
            backgroundImage: appTheme === 'dark'
              ? 'linear-gradient(45deg, #1a1a2e 25%, transparent 25%), linear-gradient(-45deg, #1a1a2e 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #1a1a2e 75%), linear-gradient(-45deg, transparent 75%, #1a1a2e 75%)'
              : 'linear-gradient(45deg, #f0f0f0 25%, transparent 25%), linear-gradient(-45deg, #f0f0f0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f0f0f0 75%), linear-gradient(-45deg, transparent 75%, #f0f0f0 75%)',
            backgroundSize: '20px 20px',
            backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0',
          }}
        >
          {imgSrc && (
            <img
              src={imgSrc}
              alt={filePath.split('/').pop() ?? 'Image'}
              onLoad={handleImageLoad}
              onError={() => setError('Failed to render image')}
              className="transition-transform duration-100"
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: 'center center',
                imageRendering: zoom > 2 ? 'pixelated' : 'auto',
              }}
              draggable={false}
            />
          )}
        </div>

        {/* Metadata/EXIF info panel */}
        {showInfoPanel && imageMeta && (
          <MetadataPanel
            metadata={imageMeta}
            onClose={() => setShowInfoPanel(false)}
          />
        )}
      </div>
    </div>
  );
};

export default ImagePreview;
