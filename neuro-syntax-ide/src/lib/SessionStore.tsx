import React, { createContext, useContext, useRef, useCallback } from 'react';
import type { TaskSessionState, NewTaskSessionState, SessionStoreAPI } from '../types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TASK_SESSION_CAPACITY = 20;
const AGENT_OUTPUT_MAX_BYTES = 40 * 1024; // 40 KB
const MESSAGE_CAP = 200;
const SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

const TRUNCATION_MARKER = '...[truncated]\n\n';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Truncate a string to `maxBytes`, keeping the newest content and prepending a marker. */
function truncateToNewest(content: string, maxBytes: number): string {
  const byteLength = new TextEncoder().encode(content).byteLength;
  if (byteLength <= maxBytes) return content;

  // Work backwards from the end to find a substring that fits within maxBytes
  const availableBytes = maxBytes - new TextEncoder().encode(TRUNCATION_MARKER).byteLength;
  let end = content.length;
  let start = end;

  while (start > 0) {
    start = Math.max(0, start - 256);
    const slice = content.slice(start, end);
    if (new TextEncoder().encode(slice).byteLength >= availableBytes) {
      // Narrow down
      let lo = start;
      let hi = end;
      while (lo < hi) {
        const mid = Math.floor((lo + hi) / 2);
        if (new TextEncoder().encode(content.slice(mid, end)).byteLength < availableBytes) {
          hi = mid;
        } else {
          lo = mid + 1;
        }
      }
      return TRUNCATION_MARKER + content.slice(lo, end);
    }
  }

  return TRUNCATION_MARKER + content.slice(start, end);
}

/** Truncate message arrays to the newest N entries. */
function truncateMessages<T>(messages: T[], cap: number): T[] {
  if (messages.length <= cap) return messages;
  return messages.slice(messages.length - cap);
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const SessionStoreContext = createContext<SessionStoreAPI | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export const SessionStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Use refs so the store persists across re-renders without triggering updates.
  // Data is purely in-memory and scoped to the app lifecycle.
  const taskSessionsRef = useRef<Map<string, TaskSessionState>>(new Map());
  const newTaskSessionRef = useRef<NewTaskSessionState | null>(null);

  // --- Task session operations ---

  const saveTaskSession = useCallback((state: TaskSessionState) => {
    const truncated: TaskSessionState = {
      ...state,
      agentOutput: truncateToNewest(state.agentOutput, AGENT_OUTPUT_MAX_BYTES),
      savedAt: Date.now(),
    };

    const map = taskSessionsRef.current;

    // FIFO eviction: if at capacity, remove the oldest entry
    if (map.size >= TASK_SESSION_CAPACITY && !map.has(state.featureId)) {
      let oldestKey = '';
      let oldestTime = Infinity;
      map.forEach((val, key) => {
        if (val.savedAt < oldestTime) {
          oldestTime = val.savedAt;
          oldestKey = key;
        }
      });
      if (oldestKey) {
        map.delete(oldestKey);
      }
    }

    map.set(state.featureId, truncated);
  }, []);

  const loadTaskSession = useCallback((featureId: string): TaskSessionState | null => {
    const map = taskSessionsRef.current;
    const session = map.get(featureId);
    if (!session) return null;

    // Check expiration: 24h
    if (Date.now() - session.savedAt > SESSION_EXPIRY_MS) {
      map.delete(featureId);
      return null;
    }

    return session;
  }, []);

  const clearTaskSession = useCallback((featureId: string) => {
    taskSessionsRef.current.delete(featureId);
  }, []);

  // --- NewTask session operations ---

  const saveNewTaskSession = useCallback((state: NewTaskSessionState) => {
    newTaskSessionRef.current = {
      ...state,
      pmMessages: truncateMessages(state.pmMessages, MESSAGE_CAP),
      extMessages: truncateMessages(state.extMessages, MESSAGE_CAP),
      savedAt: Date.now(),
    };
  }, []);

  const loadNewTaskSession = useCallback((): NewTaskSessionState | null => {
    const session = newTaskSessionRef.current;
    if (!session) return null;

    // Check expiration: 24h
    if (Date.now() - session.savedAt > SESSION_EXPIRY_MS) {
      newTaskSessionRef.current = null;
      return null;
    }

    return session;
  }, []);

  const clearNewTaskSession = useCallback(() => {
    newTaskSessionRef.current = null;
  }, []);

  const api: SessionStoreAPI = {
    saveTaskSession,
    loadTaskSession,
    clearTaskSession,
    saveNewTaskSession,
    loadNewTaskSession,
    clearNewTaskSession,
  };

  return (
    <SessionStoreContext.Provider value={api}>
      {children}
    </SessionStoreContext.Provider>
  );
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSessionStore(): SessionStoreAPI {
  const ctx = useContext(SessionStoreContext);
  if (!ctx) {
    throw new Error('useSessionStore must be used within a SessionStoreProvider');
  }
  return ctx;
}
