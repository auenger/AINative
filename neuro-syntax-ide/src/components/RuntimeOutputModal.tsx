import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Trash2, CheckCircle2 } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { cn } from '../lib/utils';
import type { ActiveSessionInfo } from '../types';

// StreamEvent type matching Rust StreamEvent (agent://chunk)
interface StreamEvent {
  text: string;
  is_done: boolean;
  error?: string;
  type?: string;
  session_id?: string;
}

interface RuntimeOutputModalProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Callback to close the modal */
  onClose: () => void;
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

export const RuntimeOutputModal: React.FC<RuntimeOutputModalProps> = ({ visible, onClose }) => {
  const [chunks, setChunks] = useState<StreamEvent[]>([]);
  const [sessionInfo, setSessionInfo] = useState<ActiveSessionInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const unlistenRef = useRef<UnlistenFn | null>(null);
  const autoScrollRef = useRef(true);

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
  useEffect(() => {
    if (!visible) return;

    let cancelled = false;

    const loadSession = async () => {
      setLoading(true);
      try {
        const info = await invoke<ActiveSessionInfo | null>('get_active_session');
        if (cancelled) return;

        if (info) {
          setSessionInfo(info);
          setIsDone(info.is_done);

          // Reconstruct chunks from session info
          if (info.chunk_count > 0 && info.output_text) {
            setChunks([{ text: info.output_text, is_done: info.is_done, error: undefined, type: 'raw', session_id: info.session_id }]);
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
  }, [visible]);

  // Clear session output
  const handleClear = useCallback(async () => {
    try {
      await invoke('clear_session_output');
    } catch (err) {
      console.error('[RuntimeOutputModal] Failed to clear session:', err);
    }
    setChunks([]);
    setSessionInfo(null);
    setIsDone(false);
    onClose();
  }, [onClose]);

  // Close without clearing
  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  // Reset state when modal closes
  useEffect(() => {
    if (!visible) {
      setChunks([]);
      setSessionInfo(null);
      setIsDone(false);
      setLoading(false);
      autoScrollRef.current = true;
    }
  }, [visible]);

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
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className={cn(
              "relative flex flex-col w-[640px] max-w-[80vw] h-[480px] max-h-[70vh]",
              "bg-surface-container-low border border-outline-variant/20 rounded-xl shadow-2xl overflow-hidden"
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant/10 cursor-move">
              <div className="flex items-center gap-2">
                <span className="text-on-surface text-sm font-semibold font-mono">
                  Runtime Output
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
                  title="Clear output and close"
                >
                  <Trash2 size={12} />
                </button>
                <button
                  onClick={handleClose}
                  className="p-1 text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
                  title="Close"
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
                <div className="text-on-surface-variant animate-pulse">Loading session output...</div>
              )}

              {!loading && chunks.length === 0 && (
                <div className="text-on-surface-variant">No output available.</div>
              )}

              {chunks.map((chunk, idx) => {
                const tag = chunkTag(chunk.type);
                return (
                  <div key={idx} className="mb-1">
                    <span className={cn('text-[9px] font-bold mr-1', tag.color)}>
                      {tag.label}
                    </span>
                    <span className="text-on-surface whitespace-pre-wrap break-words">
                      {chunk.text}
                    </span>
                    {chunk.error && (
                      <span className="text-red-400 ml-1">Error: {chunk.error}</span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-4 py-2 border-t border-outline-variant/10 text-[9px] text-on-surface-variant font-mono">
              <span>{chunks.length} chunk(s)</span>
              <div className="flex gap-3">
                <button
                  onClick={handleClear}
                  className="text-red-400 hover:text-red-300 transition-colors cursor-pointer"
                >
                  Clear
                </button>
                <button
                  onClick={handleClose}
                  className="text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
