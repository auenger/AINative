import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Bot, User, Terminal, Wrench, ChevronDown, ChevronRight,
  Clock, Hash, GitBranch, Zap, AlertTriangle, Brain, ArrowUp, Loader2,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import type {
  ClaudeHistorySessionDetail, ClaudeSessionMessage, ClaudeSessionMetadata,
  ClaudeContentBlock,
} from '../../types';

// ---------------------------------------------------------------------------
// Tauri helpers
// ---------------------------------------------------------------------------

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauri) return undefined as unknown as T;
  const { invoke: tauriInvoke } = await import('@tauri-apps/api/core');
  return tauriInvoke<T>(cmd, args);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return `${m}m ${s}s`;
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function formatTimestamp(ts: string | null): string {
  if (!ts) return '--';
  try {
    const date = new Date(ts);
    return date.toLocaleString('en-US', {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false,
    });
  } catch {
    return '--';
  }
}

function formatTokenCount(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

// ---------------------------------------------------------------------------
// Collapsible Section
// ---------------------------------------------------------------------------

function CollapsibleBlock({
  label,
  labelColor,
  icon: Icon,
  children,
  defaultOpen = false,
}: {
  label: string;
  labelColor: string;
  icon: React.ElementType;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded bg-surface-container/50 border border-outline-variant/5">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'w-full flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-bold cursor-pointer',
          labelColor,
        )}
      >
        {open ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
        <Icon size={10} />
        {label}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-2.5 pb-2 text-[10px] text-on-surface-variant whitespace-pre-wrap break-words">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Message Bubble
// ---------------------------------------------------------------------------

function MessageBubble({ message }: { message: ClaudeSessionMessage }) {
  const type = message.msg_type;
  const msg = message.message;

  if (!msg) {
    // System messages without structured content
    return (
      <div className="flex justify-center my-1">
        <div className="px-3 py-1 rounded-full bg-surface-container-highest/50 text-[9px] text-on-surface-variant font-mono">
          {type === 'system' ? 'System event' : type}
        </div>
      </div>
    );
  }

  const role = msg.role;
  const isUser = role === 'user' || type === 'user';
  const isAssistant = role === 'assistant' || type === 'assistant';

  if (isUser) {
    return (
      <div className="flex justify-end mb-2">
        <div className="max-w-[85%]">
          {msg.content.map((block, i) => (
            <UserContentBlock key={i} block={block} />
          ))}
          <div className="text-[8px] text-on-surface-variant opacity-40 text-right mt-0.5">
            {formatTimestamp(message.timestamp)}
          </div>
        </div>
      </div>
    );
  }

  if (isAssistant) {
    return (
      <div className="flex justify-start mb-2">
        <div className="max-w-[90%]">
          <div className="flex items-center gap-1.5 mb-1">
            <div className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center">
              <Bot size={10} className="text-primary" />
            </div>
            <span className="text-[9px] text-primary font-bold">Claude</span>
          </div>
          <div className="space-y-1">
            {msg.content.map((block, i) => (
              <AssistantContentBlock key={i} block={block} />
            ))}
          </div>
          <div className="text-[8px] text-on-surface-variant opacity-40 mt-0.5">
            {formatTimestamp(message.timestamp)}
          </div>
        </div>
      </div>
    );
  }

  // System or other messages
  return (
    <div className="flex justify-start mb-1">
      <div className="px-3 py-1.5 rounded bg-surface-container-highest/30 border-l-2 border-on-surface-variant/20 text-[10px] text-on-surface-variant whitespace-pre-wrap break-words">
        {msg.content.map((block, i) => (
          <span key={i}>{block.text || JSON.stringify(block)}</span>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Content Block Renderers
// ---------------------------------------------------------------------------

function UserContentBlock({ block }: { block: ClaudeContentBlock }) {
  if (block.type === 'text' && block.text) {
    return (
      <div className="px-3 py-2 rounded-lg bg-primary/15 border border-primary/10 text-on-surface text-xs whitespace-pre-wrap break-words">
        {block.text}
      </div>
    );
  }

  if (block.type === 'tool_result') {
    const contentStr = typeof block.content === 'string'
      ? block.content
      : Array.isArray(block.content)
        ? block.content.map((c: ClaudeContentBlock) => c.text || '').join('\n')
        : JSON.stringify(block.content, null, 2);

    const isLong = (contentStr || '').length > 200;

    return (
      <CollapsibleBlock
        label={`Tool Result${block.id ? ` (${block.id.slice(0, 8)})` : ''}`}
        labelColor="text-green-400"
        icon={Terminal}
      >
        {isLong ? contentStr?.slice(0, 500) + '...' : contentStr}
      </CollapsibleBlock>
    );
  }

  // Fallback
  return (
    <div className="px-3 py-2 rounded-lg bg-primary/15 border border-primary/10 text-on-surface text-xs">
      {block.text || block.type}
    </div>
  );
}

function AssistantContentBlock({ block }: { block: ClaudeContentBlock }) {
  // Text block
  if (block.type === 'text' && block.text) {
    return (
      <div className="px-3 py-2 rounded-lg bg-surface-container-low border border-outline-variant/5 text-on-surface text-xs whitespace-pre-wrap break-words leading-relaxed">
        {block.text}
      </div>
    );
  }

  // Thinking block
  if (block.type === 'thinking' && block.thinking) {
    return (
      <CollapsibleBlock
        label="Thinking"
        labelColor="text-purple-400"
        icon={Brain}
      >
        {block.thinking}
      </CollapsibleBlock>
    );
  }

  // Tool use block
  if (block.type === 'tool_use') {
    const toolName = block.name || 'unknown';
    const inputStr = block.input
      ? (typeof block.input === 'string' ? block.input : JSON.stringify(block.input, null, 2))
      : '';
    const preview = (inputStr || '').slice(0, 150);

    return (
      <CollapsibleBlock
        label={`Tool: ${toolName}`}
        labelColor="text-yellow-400"
        icon={Wrench}
      >
        <span className="text-yellow-300/80">{preview}</span>
        {(inputStr || '').length > 150 && '...'}
      </CollapsibleBlock>
    );
  }

  // Tool result
  if (block.type === 'tool_result') {
    const contentStr = typeof block.content === 'string'
      ? block.content
      : Array.isArray(block.content)
        ? block.content.map((c: ClaudeContentBlock) => c.text || '').join('\n')
        : JSON.stringify(block.content, null, 2);

    return (
      <CollapsibleBlock
        label="Tool Result"
        labelColor="text-green-400"
        icon={Terminal}
      >
        {(contentStr || '').slice(0, 1000)}
      </CollapsibleBlock>
    );
  }

  // Unknown block type
  return null;
}

// ---------------------------------------------------------------------------
// Metadata Header
// ---------------------------------------------------------------------------

function MetadataHeader({ metadata }: { metadata: ClaudeSessionMetadata }) {
  return (
    <div className="p-3 border-b border-outline-variant/10 bg-surface-container-low/50 shrink-0">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
          <Bot size={16} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-on-surface truncate">
            Session {metadata.session_id.slice(0, 8)}...
          </p>
          <div className="flex items-center gap-2 text-[9px] text-on-surface-variant">
            <span className="flex items-center gap-0.5">
              <Clock size={8} />
              {formatDuration(metadata.duration_seconds)}
            </span>
            {metadata.model && (
              <span className="flex items-center gap-0.5">
                <Zap size={8} />
                {metadata.model.length > 25 ? metadata.model.slice(0, 25) + '...' : metadata.model}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-4 gap-2 text-[9px]">
        <div className="flex flex-col">
          <span className="text-on-surface-variant opacity-60">Messages</span>
          <span className="font-mono font-bold text-on-surface">{metadata.total_messages}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-on-surface-variant opacity-60">Input</span>
          <span className="font-mono font-bold text-on-surface">{formatTokenCount(metadata.input_tokens)}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-on-surface-variant opacity-60">Output</span>
          <span className="font-mono font-bold text-on-surface">{formatTokenCount(metadata.output_tokens)}</span>
        </div>
        {metadata.git_branch && (
          <div className="flex flex-col">
            <span className="text-on-surface-variant opacity-60">Branch</span>
            <span className="font-mono font-bold text-secondary truncate">{metadata.git_branch}</span>
          </div>
        )}
      </div>

      {/* Time range */}
      <div className="flex items-center justify-between mt-2 text-[8px] text-on-surface-variant opacity-50">
        <span>{formatTimestamp(metadata.first_message_time)}</span>
        <span>to</span>
        <span>{formatTimestamp(metadata.last_message_time)}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton Loader
// ---------------------------------------------------------------------------

function ReplaySkeleton() {
  return (
    <div className="p-4 space-y-4 animate-pulse">
      <div className="flex justify-end">
        <div className="h-12 w-3/5 bg-surface-container-highest rounded-lg" />
      </div>
      <div className="flex justify-start">
        <div className="h-16 w-4/5 bg-surface-container-highest rounded-lg" />
      </div>
      <div className="flex justify-end">
        <div className="h-10 w-2/5 bg-surface-container-highest rounded-lg" />
      </div>
      <div className="flex justify-start">
        <div className="h-20 w-4/5 bg-surface-container-highest rounded-lg" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

interface SessionReplayViewProps {
  sessionId: string | null;
  workspacePath?: string;
}

export const SessionReplayView: React.FC<SessionReplayViewProps> = ({
  sessionId,
  workspacePath,
}) => {
  const [detail, setDetail] = useState<ClaudeHistorySessionDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [allMessages, setAllMessages] = useState<ClaudeSessionMessage[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const loadedSessionRef = useRef<string | null>(null);

  const PAGE_SIZE = 50;

  // Load session detail
  const loadSession = useCallback(async (sid: string, loadOffset: number = 0) => {
    if (!workspacePath) return;

    const isLoadingMore = loadOffset > 0;
    if (isLoadingMore) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const result = await invoke<ClaudeHistorySessionDetail>('get_claude_session_detail', {
        sessionId: sid,
        workspacePath,
        offset: loadOffset,
        limit: PAGE_SIZE,
      });

      if (!isLoadingMore) {
        setDetail(result);
        setAllMessages(result.messages);
      } else {
        // Prepend older messages (they come in chronological order)
        setAllMessages((prev) => [...result.messages, ...prev]);
        if (result.metadata) {
          setDetail((prev) => prev ? { ...prev, metadata: result.metadata } : result);
        }
      }

      setOffset(loadOffset + result.messages.length);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [workspacePath]);

  // Load when sessionId changes
  useEffect(() => {
    if (sessionId && sessionId !== loadedSessionRef.current) {
      loadedSessionRef.current = sessionId;
      setOffset(0);
      setAllMessages([]);
      setDetail(null);
      loadSession(sessionId, 0);
    }
  }, [sessionId, loadSession]);

  // Load more (older messages)
  const handleLoadMore = useCallback(() => {
    if (!sessionId || loadingMore || !detail?.has_more) return;
    loadSession(sessionId, offset);
  }, [sessionId, loadingMore, detail?.has_more, offset, loadSession]);

  // Scroll handler for detecting top scroll
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop } = scrollRef.current;
    if (scrollTop < 50 && detail?.has_more && !loadingMore) {
      handleLoadMore();
    }
  }, [detail?.has_more, loadingMore, handleLoadMore]);

  // No session selected
  if (!sessionId) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center px-8">
          <Bot size={32} className="mx-auto text-on-surface-variant opacity-20 mb-3" />
          <p className="text-on-surface-variant text-sm opacity-50">Select a session to view</p>
          <p className="text-on-surface-variant text-[10px] opacity-30 mt-1">
            Choose a session from the list to replay the conversation
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex-1 flex flex-col">
        <ReplaySkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center">
          <AlertTriangle size={24} className="mx-auto text-error mb-2" />
          <p className="text-error text-xs mb-1">Failed to load session</p>
          <p className="text-on-surface-variant text-[10px] opacity-60">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Metadata header */}
      {detail?.metadata && <MetadataHeader metadata={detail.metadata} />}

      {/* Load more button at top */}
      {detail?.has_more && (
        <div className="flex justify-center py-2 shrink-0">
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            className={cn(
              'flex items-center gap-1 text-[10px] text-primary hover:underline cursor-pointer',
              loadingMore && 'opacity-50',
            )}
          >
            {loadingMore ? (
              <Loader2 size={10} className="animate-spin" />
            ) : (
              <ArrowUp size={10} />
            )}
            {loadingMore ? 'Loading...' : 'Load earlier messages'}
          </button>
        </div>
      )}

      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto scroll-hide p-4"
      >
        {allMessages.map((msg, idx) => (
          <MessageBubble key={msg.uuid || idx} message={msg} />
        ))}

        {allMessages.length === 0 && !loading && (
          <div className="text-center py-8">
            <p className="text-on-surface-variant text-xs opacity-50">No messages in this session</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-outline-variant/10 shrink-0 flex items-center justify-between text-[9px] text-on-surface-variant font-mono">
        <span>{allMessages.length} messages</span>
        {detail?.metadata && (
          <span>
            {formatTokenCount(detail.metadata.input_tokens)} in / {formatTokenCount(detail.metadata.output_tokens)} out
          </span>
        )}
      </div>
    </div>
  );
};
