import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, MessageSquare, Clock, Bot, GitBranch, Wrench, AlertTriangle, ChevronRight, Inbox } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { ClaudeSessionListItem } from '../../types';

// ---------------------------------------------------------------------------
// Tauri helpers (safe no-op when running outside Tauri)
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

/** Format an ISO timestamp to a relative time string */
function formatRelativeTime(isoString: string | null): string {
  if (!isoString) return '--';
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return '--';
  }
}

/** Format an ISO timestamp to a readable time */
function formatTime(isoString: string | null): string {
  if (!isoString) return '--';
  try {
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch {
    return '--';
  }
}

/** Truncate text with ellipsis */
function truncate(text: string | null, maxLen: number): string {
  if (!text) return '';
  return text.length > maxLen ? text.slice(0, maxLen) + '...' : text;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SessionHistoryPanelProps {
  workspacePath?: string;
  selectedSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
}

// ---------------------------------------------------------------------------
// Skeleton loader
// ---------------------------------------------------------------------------

function SessionCardSkeleton() {
  return (
    <div className="p-3 rounded-lg bg-surface-container-low border border-outline-variant/10 animate-pulse">
      <div className="h-3 bg-surface-container-highest rounded w-3/4 mb-2" />
      <div className="h-2 bg-surface-container-highest rounded w-1/2 mb-1" />
      <div className="h-2 bg-surface-container-highest rounded w-1/3" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Session Card
// ---------------------------------------------------------------------------

function SessionCard({
  session,
  isSelected,
  onClick,
}: {
  session: ClaudeSessionListItem;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className={cn(
        'w-full text-left p-3 rounded-lg border transition-colors cursor-pointer',
        isSelected
          ? 'bg-primary/10 border-primary/30'
          : 'bg-surface-container-low border-outline-variant/10 hover:border-outline-variant/30',
      )}
    >
      {/* Summary */}
      <p className={cn(
        'text-xs font-medium leading-snug mb-2',
        isSelected ? 'text-primary' : 'text-on-surface',
      )}>
        {truncate(session.summary || session.first_user_content || 'Untitled Session', 80)}
      </p>

      {/* Meta row */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="flex items-center gap-1 text-[9px] text-on-surface-variant">
          <Clock size={9} />
          {formatRelativeTime(session.last_message_time)}
        </span>
        <span className="flex items-center gap-1 text-[9px] text-on-surface-variant">
          <MessageSquare size={9} />
          {session.message_count}
        </span>
        {session.git_branch && (
          <span className="flex items-center gap-1 text-[9px] text-on-surface-variant">
            <GitBranch size={9} />
            {truncate(session.git_branch, 15)}
          </span>
        )}
        {session.has_tool_use && (
          <span className="flex items-center gap-1 text-[9px] text-yellow-400">
            <Wrench size={9} />
          </span>
        )}
        {session.has_errors && (
          <span className="flex items-center gap-1 text-[9px] text-error">
            <AlertTriangle size={9} />
          </span>
        )}
      </div>

      {/* Time & model */}
      <div className="flex items-center justify-between mt-1.5">
        <span className="text-[8px] text-on-surface-variant opacity-60">
          {formatTime(session.first_message_time)}
        </span>
        {session.model && (
          <span className="flex items-center gap-1 text-[8px] text-on-surface-variant opacity-60">
            <Bot size={8} />
            {truncate(session.model, 20)}
          </span>
        )}
      </div>
    </motion.button>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export const SessionHistoryPanel: React.FC<SessionHistoryPanelProps> = ({
  workspacePath,
  selectedSessionId,
  onSelectSession,
}) => {
  const [sessions, setSessions] = useState<ClaudeSessionListItem[]>([]);
  const [filteredSessions, setFilteredSessions] = useState<ClaudeSessionListItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadedRef = useRef(false);

  // Load sessions
  const loadSessions = useCallback(async () => {
    if (!workspacePath) return;
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<ClaudeSessionListItem[]>('list_claude_sessions', {
        workspacePath,
      });
      setSessions(result);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [workspacePath]);

  // Search sessions
  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);
    if (!workspacePath) return;

    if (!query.trim()) {
      setFilteredSessions(sessions);
      return;
    }

    // Client-side filtering for responsiveness
    const lowerQuery = query.toLowerCase();
    const filtered = sessions.filter((s) => {
      const fields = [s.summary, s.first_user_content, s.last_user_content, s.project_name, s.git_branch];
      return fields.some((f) => f && f.toLowerCase().includes(lowerQuery));
    });
    setFilteredSessions(filtered);
  }, [workspacePath, sessions]);

  // Initial load
  useEffect(() => {
    if (workspacePath && !loadedRef.current) {
      loadedRef.current = true;
      loadSessions();
    }
  }, [workspacePath, loadSessions]);

  // Update filtered sessions when sessions change
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredSessions(sessions);
    } else {
      const lowerQuery = searchQuery.toLowerCase();
      const filtered = sessions.filter((s) => {
        const fields = [s.summary, s.first_user_content, s.last_user_content, s.project_name, s.git_branch];
        return fields.some((f) => f && f.toLowerCase().includes(lowerQuery));
      });
      setFilteredSessions(filtered);
    }
  }, [sessions, searchQuery]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-outline-variant/10 shrink-0">
        <h3 className="text-sm font-headline font-bold flex items-center gap-2 mb-2">
          <Bot size={14} className="text-primary" />
          Session History
        </h3>

        {/* Search box */}
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant opacity-50" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search sessions..."
            className={cn(
              'w-full pl-7 pr-3 py-1.5 text-xs rounded-md',
              'bg-surface-container-lowest border border-outline-variant/10',
              'text-on-surface placeholder:text-on-surface-variant/50',
              'focus:outline-none focus:border-primary/30 focus:ring-1 focus:ring-primary/20',
              'transition-colors',
            )}
          />
        </div>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto scroll-hide p-3 space-y-2">
        {loading && !sessions.length && (
          <>
            <SessionCardSkeleton />
            <SessionCardSkeleton />
            <SessionCardSkeleton />
            <SessionCardSkeleton />
          </>
        )}

        {error && (
          <div className="text-center py-8 px-4">
            <p className="text-error text-xs mb-1">Failed to load sessions</p>
            <p className="text-on-surface-variant text-[10px] opacity-60">{error}</p>
            <button
              onClick={loadSessions}
              className="mt-2 text-primary text-xs hover:underline cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && filteredSessions.length === 0 && (
          <div className="text-center py-8 px-4">
            <Inbox size={24} className="mx-auto text-on-surface-variant opacity-30 mb-2" />
            <p className="text-on-surface-variant text-xs opacity-60">
              {searchQuery ? 'No matching sessions found' : 'No Claude Code sessions found'}
            </p>
            <p className="text-on-surface-variant text-[10px] opacity-40 mt-1">
              {!searchQuery && 'Sessions will appear here after using Claude Code in this workspace'}
            </p>
          </div>
        )}

        {filteredSessions.map((session) => (
          <SessionCard
            key={session.session_id}
            session={session}
            isSelected={selectedSessionId === session.session_id}
            onClick={() => onSelectSession(session.session_id)}
          />
        ))}
      </div>

      {/* Footer count */}
      <div className="px-4 py-2 border-t border-outline-variant/10 shrink-0">
        <span className="text-[9px] text-on-surface-variant font-mono">
          {filteredSessions.length} session{filteredSessions.length !== 1 ? 's' : ''}
          {searchQuery && ` (filtered from ${sessions.length})`}
        </span>
      </div>
    </div>
  );
};
