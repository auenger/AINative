import { useState, useEffect, useCallback, useRef } from 'react';
import { RuntimeProcessInfo } from '../types';

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export interface RuntimeMonitorState {
  /** Currently detected runtime processes */
  runtimes: RuntimeProcessInfo[];
  /** Whether the monitor is actively running */
  isMonitoring: boolean;
  /** Whether a scan is in progress */
  scanning: boolean;
  /** Last error, if any */
  error: string | null;
  /** Start the monitor */
  start: (workspacePath: string) => Promise<void>;
  /** Stop the monitor */
  stop: () => Promise<void>;
  /** Trigger an immediate one-shot scan */
  scan: (workspacePath: string) => Promise<void>;
  /** Get a runtime process by id */
  getRuntime: (runtimeId: string) => RuntimeProcessInfo | undefined;
  /** Whether any claude-code runtime is currently running */
  hasActiveRuntime: boolean;
}

export function useRuntimeMonitor(): RuntimeMonitorState {
  const [runtimes, setRuntimes] = useState<RuntimeProcessInfo[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const unlistenRef = useRef<(() => void) | null>(null);

  const hasActiveRuntime = runtimes.some(r => r.status === 'running');
  const isMonitoringRef = useRef(false);

  const getRuntime = useCallback((runtimeId: string): RuntimeProcessInfo | undefined => {
    return runtimes.find(r => r.runtime_id === runtimeId);
  }, [runtimes]);

  const scan = useCallback(async (workspacePath: string) => {
    if (!isTauri) {
      // Dev fallback: simulate a running Claude Code process
      setRuntimes([
        {
          runtime_id: 'claude-code',
          name: 'Claude Code',
          pid: 12345,
          status: 'running',
          working_dir: workspacePath || '/dev/workspace',
          cpu_usage: 2.5,
          memory_bytes: 256 * 1024 * 1024,
          started_at: Math.floor(Date.now() / 1000) - 300,
        },
      ]);
      return;
    }

    setScanning(true);
    setError(null);

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const result: RuntimeProcessInfo[] = await invoke('scan_runtime_processes', {
        workspacePath,
      });
      setRuntimes(result);
    } catch (e: any) {
      const errMsg = e?.toString() ?? 'Failed to scan runtime processes';
      setError(errMsg);
    } finally {
      setScanning(false);
    }
  }, []);

  const start = useCallback(async (workspacePath: string) => {
    // Prevent double-starting
    if (isMonitoringRef.current) return;
    isMonitoringRef.current = true;

    if (!isTauri) {
      // Dev fallback: simulate monitoring with periodic updates
      setIsMonitoring(true);

      // Simulate initial state
      setRuntimes([
        {
          runtime_id: 'claude-code',
          name: 'Claude Code',
          pid: 12345,
          status: 'running',
          working_dir: workspacePath || '/dev/workspace',
          cpu_usage: Math.random() * 10,
          memory_bytes: 256 * 1024 * 1024,
          started_at: Math.floor(Date.now() / 1000) - 300,
        },
      ]);

      // Simulate periodic updates
      const interval = setInterval(() => {
        if (!isMonitoringRef.current) {
          clearInterval(interval);
          return;
        }
        setRuntimes(prev => prev.map(r => ({
          ...r,
          cpu_usage: Math.random() * 15,
          memory_bytes: (200 + Math.random() * 100) * 1024 * 1024,
        })));
      }, 2000);

      unlistenRef.current = () => {
        clearInterval(interval);
        isMonitoringRef.current = false;
      };
      return;
    }

    try {
      // Listen for runtime status events
      const { listen } = await import('@tauri-apps/api/event');
      const unlisten = await listen<{ runtimes: RuntimeProcessInfo[]; timestamp: number }>(
        'runtime://status-changed',
        (event) => {
          setRuntimes(event.payload.runtimes);
        }
      );
      unlistenRef.current = unlisten;

      // Start the backend monitor
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('start_runtime_monitor', { workspacePath });
      setIsMonitoring(true);
      isMonitoringRef.current = true;
    } catch (e: any) {
      setError(e?.toString() ?? 'Failed to start runtime monitor');
    }
  }, []);

  const stop = useCallback(async () => {
    isMonitoringRef.current = false;

    // Clean up listener
    if (unlistenRef.current) {
      unlistenRef.current();
      unlistenRef.current = null;
    }

    if (isTauri) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('stop_runtime_monitor');
      } catch {
        // Ignore errors on stop
      }
    }

    setIsMonitoring(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMonitoringRef.current = false;
      if (unlistenRef.current) {
        unlistenRef.current();
        unlistenRef.current = null;
      }
    };
  }, []);

  return {
    runtimes,
    isMonitoring,
    scanning,
    error,
    start,
    stop,
    scan,
    getRuntime,
    hasActiveRuntime,
  };
}
