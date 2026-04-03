import { useState, useEffect, useCallback } from 'react';
import { AgentRuntimeInfo, AgentRuntimeStatusType } from '../types';

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export interface AgentRuntimesState {
  /** All detected runtimes */
  runtimes: AgentRuntimeInfo[];
  /** Number of available (detected & healthy) runtimes */
  availableCount: number;
  /** Whether a scan is in progress */
  scanning: boolean;
  /** Last scan error, if any */
  error: string | null;
  /** Trigger a re-scan of all runtimes */
  scan: () => Promise<void>;
  /** Get a single runtime by id */
  getRuntime: (id: string) => AgentRuntimeInfo | undefined;
}

export function useAgentRuntimes(): AgentRuntimesState {
  const [runtimes, setRuntimes] = useState<AgentRuntimeInfo[]>([]);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableCount = runtimes.filter(r => r.status === 'available' || r.status === 'busy').length;

  const scan = useCallback(async () => {
    if (!isTauri) {
      // Dev fallback: simulate some runtimes
      setRuntimes([
        {
          id: 'claude-code',
          name: 'Claude Code',
          type: 'cli',
          status: 'available',
          version: '1.0.0',
          install_path: '/usr/local/bin/claude',
          capabilities: ['streaming', 'sessions', 'tool-use', 'structured-output'],
          install_hint: 'npm install -g @anthropic-ai/claude-code',
        },
        {
          id: 'codex',
          name: 'OpenAI Codex CLI',
          type: 'cli',
          status: 'not-installed',
          version: null,
          install_path: null,
          capabilities: ['streaming', 'tool-use', 'structured-output'],
          install_hint: 'npm install -g @openai/codex',
        },
      ]);
      return;
    }

    setScanning(true);
    setError(null);

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const result: AgentRuntimeInfo[] = await invoke('scan_agent_runtimes');
      setRuntimes(result);
    } catch (e: any) {
      const errMsg = e?.toString() ?? 'Failed to scan agent runtimes';
      setError(errMsg);
    } finally {
      setScanning(false);
    }
  }, []);

  const getRuntime = useCallback((id: string): AgentRuntimeInfo | undefined => {
    return runtimes.find(r => r.id === id);
  }, [runtimes]);

  // Auto-scan on mount
  useEffect(() => {
    scan();
  }, [scan]);

  return {
    runtimes,
    availableCount,
    scanning,
    error,
    scan,
    getRuntime,
  };
}
