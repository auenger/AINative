import React, { useState, useCallback, useRef, useEffect } from 'react';
import { cn } from '../../lib/utils';
import { AlertTriangle, ZoomIn, ZoomOut, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';

// ---------------------------------------------------------------------------
// pdfjs-dist — worker setup
// We use a dynamic import approach so the library is only loaded when needed.
// ---------------------------------------------------------------------------
let _pdfjsLoaded = false;
let _pdfjs: typeof import('pdfjs-dist') | null = null;

async function getPdfjs() {
  if (_pdfjsLoaded && _pdfjs) return _pdfjs;
  const pdfjs = await import('pdfjs-dist');
  // Set worker source — use the bundled copy from the installed package
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString();
  _pdfjs = pdfjs;
  _pdfjsLoaded = true;
  return pdfjs;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PdfPreviewProps {
  /** Absolute file path of the PDF. */
  filePath: string;
  /** Whether running inside Tauri (to use invoke for file read). */
  isTauri: boolean;
}

// ---------------------------------------------------------------------------
// PdfPreview component — renders PDF with page navigation and zoom
// ---------------------------------------------------------------------------

export const PdfPreview: React.FC<PdfPreviewProps> = ({ filePath, isTauri }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<any>(null);

  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);

  const fileName = filePath.split('/').pop() ?? filePath;

  // -------------------------------------------------------------------------
  // Load PDF file
  // -------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    async function loadPdf() {
      setLoading(true);
      setError(null);
      setPdfDoc(null);
      setTotalPages(0);
      setCurrentPage(1);
      setZoom(1);

      try {
        if (!isTauri) {
          setError('PDF preview is only available in Tauri desktop mode.');
          setLoading(false);
          return;
        }

        const pdfjs = await getPdfjs();
        if (cancelled) return;

        const { invoke } = await import('@tauri-apps/api/core');
        const base64 = await invoke<string>('read_file_base64', { path: filePath });
        if (cancelled) return;

        // Decode base64 to binary
        const binaryString = atob(base64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        const loadingTask = pdfjs.getDocument({ data: bytes });
        const doc = await loadingTask.promise;
        if (cancelled) return;

        setPdfDoc(doc);
        setTotalPages(doc.numPages);
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.toString() ?? 'Failed to load PDF');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadPdf();

    return () => {
      cancelled = true;
    };
  }, [filePath, isTauri]);

  // -------------------------------------------------------------------------
  // Render current page to canvas
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;

    let cancelled = false;

    async function renderPage() {
      // Cancel any in-flight render
      if (renderTaskRef.current) {
        try { renderTaskRef.current.cancel(); } catch { /* ignore */ }
        renderTaskRef.current = null;
      }

      try {
        const page = await pdfDoc.getPage(currentPage);
        if (cancelled) return;

        const viewport = page.getViewport({ scale: zoom });
        const canvas = canvasRef.current!;
        const context = canvas.getContext('2d')!;

        // HiDPI support
        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        context.setTransform(dpr, 0, 0, dpr, 0, 0);

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        const task = page.render(renderContext);
        renderTaskRef.current = task;
        await task.promise;
        renderTaskRef.current = null;
      } catch (err: any) {
        // RenderingCancelled is expected when switching pages quickly
        if (err?.name !== 'RenderingCancelledException' && !cancelled) {
          console.error('PDF render error:', err);
        }
      }
    }

    renderPage();

    return () => {
      cancelled = true;
    };
  }, [pdfDoc, currentPage, zoom]);

  // Cleanup render task on unmount
  useEffect(() => {
    return () => {
      if (renderTaskRef.current) {
        try { renderTaskRef.current.cancel(); } catch { /* ignore */ }
      }
    };
  }, []);

  // -------------------------------------------------------------------------
  // Page navigation
  // -------------------------------------------------------------------------
  const goToPrevPage = useCallback(() => {
    setCurrentPage(prev => Math.max(1, prev - 1));
  }, []);

  const goToNextPage = useCallback(() => {
    setCurrentPage(prev => Math.min(totalPages, prev + 1));
  }, [totalPages]);

  // -------------------------------------------------------------------------
  // Zoom controls
  // -------------------------------------------------------------------------
  const zoomIn = useCallback(() => setZoom(prev => Math.min(5, prev + 0.25)), []);
  const zoomOut = useCallback(() => setZoom(prev => Math.max(0.25, prev - 0.25)), []);
  const zoomReset = useCallback(() => setZoom(1), []);

  // -------------------------------------------------------------------------
  // Keyboard shortcuts
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
      } else if (e.key === 'PageDown' || e.key === 'ArrowDown') {
        // Only handle if no modifier and not inside an input
        if (!e.metaKey && !e.ctrlKey && !e.altKey) {
          e.preventDefault();
          goToNextPage();
        }
      } else if (e.key === 'PageUp' || e.key === 'ArrowUp') {
        if (!e.metaKey && !e.ctrlKey && !e.altKey) {
          e.preventDefault();
          goToPrevPage();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [zoomIn, zoomOut, zoomReset, goToNextPage, goToPrevPage]);

  // -------------------------------------------------------------------------
  // Render: Loading state
  // -------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-surface-container-lowest gap-4">
        <div className="relative w-8 h-8">
          <div className="absolute inset-0 rounded-full border-2 border-[var(--t-editor-spinner-track)] border-t-[var(--t-editor-spinner-bar)] animate-spin" />
        </div>
        <p className="text-[10px] text-outline uppercase tracking-widest">Loading PDF...</p>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Render: Error state
  // -------------------------------------------------------------------------
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-surface-container-lowest gap-4">
        <AlertTriangle size={32} className="text-error/60" />
        <div className="flex flex-col items-center gap-1 text-center max-w-sm">
          <p className="text-xs text-error font-medium">{error}</p>
          <p className="text-[10px] text-outline">{fileName}</p>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Render: PDF viewer
  // -------------------------------------------------------------------------
  return (
    <div
      ref={containerRef}
      className="flex flex-col h-full bg-surface-container-lowest overflow-hidden"
    >
      {/* Toolbar: page navigation + zoom controls */}
      <div className="flex items-center gap-2 px-4 py-2 bg-surface-container-low border-b border-outline-variant/10 shrink-0">
        {/* Page navigation */}
        <button
          onClick={goToPrevPage}
          disabled={currentPage <= 1}
          className={cn(
            "p-1 rounded transition-colors",
            currentPage <= 1
              ? "text-outline/30 cursor-not-allowed"
              : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
          )}
          title="Previous Page (PageUp)"
        >
          <ChevronLeft size={14} />
        </button>
        <span className="text-[10px] font-mono text-on-surface-variant min-w-[64px] text-center">
          {currentPage} / {totalPages}
        </span>
        <button
          onClick={goToNextPage}
          disabled={currentPage >= totalPages}
          className={cn(
            "p-1 rounded transition-colors",
            currentPage >= totalPages
              ? "text-outline/30 cursor-not-allowed"
              : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
          )}
          title="Next Page (PageDown)"
        >
          <ChevronRight size={14} />
        </button>

        {/* Separator */}
        <div className="w-px h-4 bg-outline-variant/20 mx-1" />

        {/* Zoom controls */}
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
          title="Reset Zoom (Cmd+0)"
        >
          <RotateCcw size={14} />
        </button>

        {/* File name */}
        <span className="ml-auto text-[10px] text-outline font-mono truncate max-w-[200px]">
          {fileName}
        </span>
      </div>

      {/* PDF canvas display area */}
      <div className="flex-1 overflow-auto flex items-start justify-center p-6">
        <canvas
          ref={canvasRef}
          className="shadow-lg"
          style={{
            maxWidth: 'none',
          }}
        />
      </div>
    </div>
  );
};

export default PdfPreview;
