import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Trash2, CheckCircle2, ChevronDown, ChevronRight } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { cn } from '../lib/utils';
import { useTranslation } from 'react-i18next';
import type { ActiveSessionInfo, StreamEventChunk } from '../types';

// StreamEvent type matching Rust StreamEvent (agent://chunk)
interface StreamEvent {
  text: string;
  is_done: boolean;
  error?: string;
  type?: string;
  session_id?: string;
  /** Idle seconds (only set for idle_warning events) */
  idle_seconds?: number;
}

interface RuntimeOutputModalProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Callback to close the modal */
  onClose: () => void;
  /** Runtime ID to fetch session output for (feat-runtime-output-polish) */
  runtimeId: string;
  /** Runtime display name for the header (feat-runtime-output-polish) */
  runtimeName: string;
}

// ---------------------------------------------------------------------------
// Parsed JSON chunk types for smart rendering
// ---------------------------------------------------------------------------

interface ParsedJsonChunk {
  TYPE?: string;
  CONTENT?: string;
  TOOL_USE_ID?: string;
  TIMESTAMP?: string | number;
  tool_name?: string;
  input?: string;
  message?: string;
  text?: string;
  [key: string]: string | number | boolean | null | undefined;
}

/** Format a timestamp (ISO string or unix epoch number) to readable time */
function formatTimestamp(ts: string | number | undefined): string | null {
  if (ts == null) return null;
  try {
    const date = typeof ts === 'number'
      ? new Date(ts * 1000)
      : new Date(ts);
    if (isNaN(date.getTime())) return null;
    return date.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return null;
  }
}

/** Try to parse a chunk text as JSON. Returns null if not valid JSON. */
function tryParseJson(text: string): ParsedJsonChunk | null {
  try {
    const trimmed = text.trim();
    if (!trimmed.startsWith('{')) return null;
    const obj = JSON.parse(trimmed);
    if (typeof obj !== 'object' || obj === null) return null;
    return obj as ParsedJsonChunk;
  } catch {
    return null;
  }
}

/** Maximum character length before a content block is collapsed */
const COLLAPSE_THRESHOLD = 300;

/** Check if a chunk has meaningful content to display */
function hasContent(chunk: StreamEvent): boolean {
  // Has text content
  if (chunk.text.trim().length > 0) return true;
  // Has error
  if (chunk.error && chunk.error.trim().length > 0) return true;
  // System messages with no text but a type tag are still meaningful
  if (chunk.type === 'system') return false;
  return false;
}

// ---------------------------------------------------------------------------
// Smart chunk renderer
// ---------------------------------------------------------------------------

/** Render a single session chunk with smart JSON parsing */
function SessionChunkRenderer({ chunk, index }: { chunk: StreamEvent; index: number }) {
  const [expanded, setExpanded] = useState(false);

  // Try JSON parse for smart rendering
  const parsed = tryParseJson(chunk.text);

  // Extract timestamp
  const ts = parsed ? formatTimestamp(parsed.TIMESTAMP) : null;

  // If not JSON, render as raw text with the original tag
  if (!parsed) {
    const tag = chunkTag(chunk.type);
    const needsCollapse = chunk.text.length > COLLAPSE_THRESHOLD;
    const displayText = needsCollapse && !expanded
      ? chunk.text.slice(0, COLLAPSE_THRESHOLD)
      : chunk.text;

    return (
      <div className="mb-1.5">
        <span className={cn('text-[9px] font-bold mr-1', tag.color)}>
          {tag.label}
        </span>
        {ts && (
          <span className="text-on-surface-variant text-[8px] mr-1 opacity-60">{ts}</span>
        )}
        <span className="text-on-surface whitespace-pre-wrap break-words">
          {displayText}
        </span>
        {needsCollapse && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="ml-1 text-primary text-[9px] hover:underline cursor-pointer inline-flex items-center gap-0.5"
          >
            {expanded ? <ChevronDown size={8} /> : <ChevronRight size={8} />}
            {expanded ? 'collapse' : `+${chunk.text.length - COLLAPSE_THRESHOLD} more`}
          </button>
        )}
        {chunk.error && (
          <span className="text-red-400 ml-1">Error: {chunk.error}</span>
        )}
      </div>
    );
  }

  // Smart rendering based on TYPE field
  const type = parsed.TYPE || chunk.type || 'unknown';

  switch (type) {
    case 'TOOL_RESULT': {
      const content = parsed.CONTENT || '';
      const needsCollapse = content.length > COLLAPSE_THRESHOLD;
      const displayContent = needsCollapse && !expanded
        ? content.slice(0, COLLAPSE_THRESHOLD)
        : content;

      return (
        <div className="mb-1.5 py-1 px-2 rounded bg-green-500/10 border-l-2 border-green-400">
          <div className="flex items-center gap-1.5">
            <span className="text-green-400 text-[9px] font-bold">[tool result]</span>
            {ts && (
              <span className="text-on-surface-variant text-[8px] opacity-60">{ts}</span>
            )}
          </div>
          <span className="text-green-300 whitespace-pre-wrap break-words text-[11px]">
            {displayContent}
          </span>
          {needsCollapse && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="ml-1 text-primary text-[9px] hover:underline cursor-pointer inline-flex items-center gap-0.5"
            >
              {expanded ? <ChevronDown size={8} /> : <ChevronRight size={8} />}
              {expanded ? 'collapse' : `+${content.length - COLLAPSE_THRESHOLD} more`}
            </button>
          )}
        </div>
      );
    }

    case 'tool_use': {
      const toolName = parsed.tool_name || parsed.name || 'unknown tool';
      const input = parsed.input || '';
      const inputPreview = typeof input === 'string'
        ? input.slice(0, 100)
        : JSON.stringify(input).slice(0, 100);

      return (
        <div className="mb-1.5 py-1 px-2 rounded bg-yellow-500/10 border-l-2 border-yellow-400">
          <div className="flex items-center gap-1.5">
            <span className="text-yellow-400 text-[9px] font-bold">[tool_use]</span>
            <span className="text-yellow-300 text-[10px] font-medium">{String(toolName)}</span>
            {ts && (
              <span className="text-on-surface-variant text-[8px] opacity-60">{ts}</span>
            )}
          </div>
          {inputPreview && (
            <span className="text-on-surface-variant text-[10px] whitespace-pre-wrap break-words">
              {inputPreview}
              {(typeof input === 'string' ? input.length : JSON.stringify(input).length) > 100 ? '...' : ''}
            </span>
          )}
        </div>
      );
    }

    case 'assistant': {
      const message = parsed.message || parsed.text || chunk.text;
      const needsCollapse = message.length > COLLAPSE_THRESHOLD;
      const displayMsg = needsCollapse && !expanded
        ? message.slice(0, COLLAPSE_THRESHOLD)
        : message;

      return (
        <div className="mb-1.5 py-1 px-2 rounded bg-blue-500/10 border-l-2 border-blue-400">
          <div className="flex items-center gap-1.5">
            <span className="text-blue-400 text-[9px] font-bold">[assistant]</span>
            {ts && (
              <span className="text-on-surface-variant text-[8px] opacity-60">{ts}</span>
            )}
          </div>
          <span className="text-blue-200 whitespace-pre-wrap break-words text-[11px]">
            {displayMsg}
          </span>
          {needsCollapse && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="ml-1 text-primary text-[9px] hover:underline cursor-pointer inline-flex items-center gap-0.5"
            >
              {expanded ? <ChevronDown size={8} /> : <ChevronRight size={8} />}
              {expanded ? 'collapse' : `+${message.length - COLLAPSE_THRESHOLD} more`}
            </button>
          )}
        </div>
      );
    }

    case 'system': {
      const message = parsed.message || chunk.text;
      return (
        <div className="mb-1.5 py-1 px-2 rounded bg-purple-500/10 border-l-2 border-purple-400">
          <div className="flex items-center gap-1.5">
            <span className="text-purple-400 text-[9px] font-bold">[system]</span>
            {ts && (
              <span className="text-on-surface-variant text-[8px] opacity-60">{ts}</span>
            )}
          </div>
          <span className="text-purple-200 whitespace-pre-wrap break-words text-[11px]">
            {message}
          </span>
        </div>
      );
    }

    default: {
      // Unknown JSON type — render with type tag + full content
      const tag = chunkTag(type);
      const content = chunk.text;
      const needsCollapse = content.length > COLLAPSE_THRESHOLD;
      const displayContent = needsCollapse && !expanded
        ? content.slice(0, COLLAPSE_THRESHOLD)
        : content;

      return (
        <div className="mb-1.5">
          <span className={cn('text-[9px] font-bold mr-1', tag.color)}>
            {tag.label}
          </span>
          {ts && (
            <span className="text-on-surface-variant text-[8px] mr-1 opacity-60">{ts}</span>
          )}
          <span className="text-on-surface whitespace-pre-wrap break-words">
            {displayContent}
          </span>
          {needsCollapse && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="ml-1 text-primary text-[9px] hover:underline cursor-pointer inline-flex items-center gap-0.5"
            >
              {expanded ? <ChevronDown size={8} /> : <ChevronRight size={8} />}
              {expanded ? 'collapse' : `+${content.length - COLLAPSE_THRESHOLD} more`}
            </button>
          )}
          {chunk.error && (
            <span className="text-red-400 ml-1">Error: {chunk.error}</span>
          )}
        </div>
      );
    }
  }
}

/** Tag label and color for different StreamEvent types */
function chunkTag(type: string | null | undefined): { label: string; color: string } {
  switch (type) {
    case 'assistant':
      return { label: '[assistant]', color: 'text-blue-400' };
    case 'tool_use':
      return { label: '[tool_use]', color: 'text-yellow-400' };
    case 'system':
      return { label: '[system]', color: 'text-purple-400' };
    case 'raw':
      return { label: '[raw]', color: 'text-green-400' };
    case 'result':
      return { label: '[result]', color: 'text-cyan-400' };
    default:
      return { label: '[output]', color: 'text-on-surface-variant' };
  }
}

export const RuntimeOutputModal: React.FC<RuntimeOutputModalProps> = ({
  visible,
  onClose,
  runtimeId,
  runtimeName,
}) => {
  const { t } = useTranslation();
  const [chunks, setChunks] = useState<StreamEvent[]>([]);
  const [sessionInfo, setSessionInfo] = useState<ActiveSessionInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const unlistenRef = useRef<UnlistenFn | null>(null);
  const autoScrollRef = useRef(true);

  // Idle warning state (feat-runtime-timeout-reminder)
  const [idleWarningSeconds, setIdleWarningSeconds] = useState<number | null>(null);

  // Modal drag state (feat-runtime-output-polish: Task 1)
  // Reset position when modal opens so it starts centered
  const [modalPos, setModalPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDraggingModal, setIsDraggingModal] = useState(false);
  const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const prevVisibleRef = useRef(false);

  // Reset drag position when modal reopens
  useEffect(() => {
    if (visible && !prevVisibleRef.current) {
      setModalPos({ x: 0, y: 0 });
    }
    prevVisibleRef.current = visible;
  }, [visible]);

  // Modal resize state (fix-runtime-output-render: 800x560 for better readability)
  const [modalSize, setModalSize] = useState<{ w: number; h: number }>({ w: 800, h: 560 });
  const modalRef = useRef<HTMLDivElement>(null);

  // Track the runtimeId for which we have loaded data
  const loadedRuntimeRef = useRef<string | null>(null);

  // --- Drag handlers (same pattern as NewTaskModal) ---
  const handleModalHeaderMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    setIsDraggingModal(true);
    dragOffsetRef.current = {
      x: e.clientX - modalPos.x,
      y: e.clientY - modalPos.y,
    };
  }, [modalPos]);

  useEffect(() => {
    if (!isDraggingModal) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newX = e.clientX - dragOffsetRef.current.x;
      const newY = e.clientY - dragOffsetRef.current.y;
      // Allow dragging across most of the screen, only keep header accessible
      const clampedX = Math.max(-window.innerWidth * 0.8, Math.min(window.innerWidth * 0.8, newX));
      const clampedY = Math.max(-window.innerHeight * 0.8, Math.min(window.innerHeight * 0.8, newY));
      setModalPos({ x: clampedX, y: clampedY });
    };

    const handleMouseUp = () => {
      setIsDraggingModal(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingModal]);

  // --- Resize observer for min size constraint ---
  useEffect(() => {
    const el = modalRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width < 400 || height < 300) {
          setModalSize({
            w: Math.max(400, width),
            h: Math.max(300, height),
          });
        }
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, [visible]);

  // Auto-scroll to bottom when new chunks arrive
  useEffect(() => {
    if (autoScrollRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chunks]);

  // Detect scroll: disable auto-scroll if user scrolls up
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    autoScrollRef.current = scrollHeight - scrollTop - clientHeight < 40;
  }, []);

  // Load buffered output and listen for live chunks
  // Keyed by runtimeId — loads fresh data when runtimeId changes
  useEffect(() => {
    if (!visible) return;

    let cancelled = false;

    // Reset data if runtimeId changed
    if (loadedRuntimeRef.current !== runtimeId) {
      loadedRuntimeRef.current = runtimeId;
      setChunks([]);
      setSessionInfo(null);
      setIsDone(false);
      setIdleWarningSeconds(null);
      setLoading(true);
    }

    const loadSession = async () => {
      if (loadedRuntimeRef.current !== runtimeId) return;
      setLoading(true);
      try {
        // Try structured chunk loading first (fix-runtime-output-render)
        const structuredChunks = await invoke<StreamEventChunk[] | null>('get_session_chunks', { runtimeId });
        if (cancelled) return;

        if (structuredChunks && structuredChunks.length > 0) {
          // Filter empty chunks (no text and no error)
          const filteredChunks = structuredChunks.filter(
            (c) => c.text.trim().length > 0 || (c.error && c.error.trim().length > 0)
          );
          setChunks(filteredChunks as StreamEvent[]);
          const lastChunk = structuredChunks[structuredChunks.length - 1];
          setIsDone(lastChunk?.is_done ?? false);

          // Also get session info for header display
          const info = await invoke<ActiveSessionInfo | null>('get_active_session', { runtimeId });
          if (!cancelled && info) {
            setSessionInfo(info);
          }
        } else {
          // Fallback to legacy get_active_session (backward compatibility)
          const info = await invoke<ActiveSessionInfo | null>('get_active_session', { runtimeId });
          if (cancelled) return;

          if (info) {
            setSessionInfo(info);
            setIsDone(info.is_done);

            // Reconstruct chunks from session info
            if (info.chunk_count > 0 && info.output_text) {
              setChunks([{ text: info.output_text, is_done: info.is_done, error: undefined, type: 'raw', session_id: info.session_id }]);
            }
          }
        }
      } catch (err) {
        console.error('[RuntimeOutputModal] Failed to load session:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadSession();

    // Listen for live agent://chunk events
    const setupListener = async () => {
      const unlisten = await listen<StreamEvent>('agent://chunk', (event) => {
        if (cancelled) return;
        const chunk = event.payload;

        // Handle idle_warning: update warning state, don't add to chunks
        if (chunk.type === 'idle_warning') {
          setIdleWarningSeconds(chunk.idle_seconds ?? null);
          return;
        }

        // Any real output clears the idle warning
        if (chunk.text.trim() || chunk.error?.trim()) {
          setIdleWarningSeconds(null);
        }

        // Skip empty chunks in live stream
        if (!chunk.text.trim() && !chunk.error?.trim()) return;
        setChunks((prev) => [...prev, chunk]);
        if (chunk.is_done) {
          setIsDone(true);
        }
      });
      unlistenRef.current = unlisten;
    };

    setupListener();

    return () => {
      cancelled = true;
      if (unlistenRef.current) {
        unlistenRef.current();
        unlistenRef.current = null;
      }
    };
  }, [visible, runtimeId]);

  // Clear session output for this runtime
  const handleClear = useCallback(async () => {
    try {
      await invoke('clear_session_output', { runtimeId });
    } catch (err) {
      console.error('[RuntimeOutputModal] Failed to clear session:', err);
    }
    setChunks([]);
    setSessionInfo(null);
    setIsDone(false);
    loadedRuntimeRef.current = null;
    onClose();
  }, [onClose, runtimeId]);

  // Close without clearing (feat-runtime-output-polish: Task 4)
  // Content is preserved — only hide the modal
  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  // NOTE: We intentionally do NOT reset chunks/sessionInfo when visible becomes false.
  // This preserves content when closing and reopening (Task 4).
  // Only switching runtimeId or pressing Clear resets the data.

  return (
    <AnimatePresence>
      {visible && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            ref={modalRef}
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{
              scale: 1,
              opacity: 1,
              x: modalPos.x,
              y: modalPos.y,
            }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            style={{
              width: modalSize.w,
              height: modalSize.h,
              maxWidth: '90vw',
              maxHeight: '85vh',
              minWidth: 400,
              minHeight: 300,
              resize: 'both',
              overflow: 'hidden',
            }}
            className={cn(
              "relative flex flex-col",
              "bg-surface-container-low border border-outline-variant/20 rounded-xl shadow-2xl"
            )}
          >
            {/* Header -- draggable */}
            <div
              className={cn(
                "flex items-center justify-between px-4 py-3 border-b border-outline-variant/10",
                isDraggingModal ? "cursor-grabbing" : "cursor-grab"
              )}
              onMouseDown={handleModalHeaderMouseDown}
            >
              <div className="flex items-center gap-2">
                <span className="text-on-surface text-sm font-semibold font-mono">
                  {runtimeName} Output
                </span>
                {sessionInfo && (
                  <span className="text-on-surface-variant text-[9px] font-mono">
                    {sessionInfo.session_id.slice(0, 8)}...
                  </span>
                )}
                {isDone && (
                  <span className="flex items-center gap-1 text-green-400 text-[10px] font-mono">
                    <CheckCircle2 size={10} />
                    Completed
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {!isDone && chunks.length > 0 && (
                  <span className="text-yellow-400 text-[9px] font-mono animate-pulse">
                    Streaming...
                  </span>
                )}
                <button
                  onClick={handleClear}
                  className="p-1 text-on-surface-variant hover:text-red-400 transition-colors cursor-pointer"
                  title={t('output.clearClose')}
                >
                  <Trash2 size={12} />
                </button>
                <button
                  onClick={handleClose}
                  className="p-1 text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
                  title={t('output.close')}
                >
                  <X size={12} />
                </button>
              </div>
            </div>

            {/* Output area */}
            <div
              ref={scrollRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto p-3 font-mono text-[11px] leading-relaxed"
            >
              {loading && (
                <div className="text-on-surface-variant animate-pulse">{t('output.loadingSession')}</div>
              )}

              {!loading && chunks.length === 0 && (
                <div className="text-on-surface-variant">{t('output.noOutput')}</div>
              )}

              {chunks.map((chunk, idx) => (
                <SessionChunkRenderer key={idx} chunk={chunk} index={idx} />
              ))}
            </div>

            {/* Idle warning bar (feat-runtime-timeout-reminder) */}
            <AnimatePresence>
              {idleWarningSeconds !== null && !isDone && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="px-4 py-2 border-t border-outline-variant/10"
                >
                  <div className="flex items-center gap-2 bg-[#ffb4ab]/15 rounded-md px-3 py-1.5">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ffb4ab] opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-[#ffb4ab]" />
                    </span>
                    <span className="text-[#ffb4ab] text-[10px] font-mono animate-pulse">
                      Session idle for {idleWarningSeconds}s, still running...
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Footer */}
            <div className="flex items-center justify-between px-4 py-2 border-t border-outline-variant/10 text-[9px] text-on-surface-variant font-mono">
              <span>{chunks.length} chunk(s)</span>
              <div className="flex gap-3">
                <button
                  onClick={handleClear}
                  className="text-red-400 hover:text-red-300 transition-colors cursor-pointer"
                >
                  {t('output.clearClose')}
                </button>
                <button
                  onClick={handleClose}
                  className="text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
                >
                  {t('output.close')}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
