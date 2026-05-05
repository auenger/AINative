import { useState, useCallback, useRef, useEffect } from 'react';
import type { TaskSchedule, ScheduleAction, ScheduleStatus } from '../types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'neuro-syntax-ide:schedules';
const POLL_INTERVAL_MS = 30_000; // 30 seconds

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateId(): string {
  return `sch-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function loadSchedules(): TaskSchedule[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as TaskSchedule[];
  } catch {
    return [];
  }
}

function persistSchedules(schedules: TaskSchedule[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(schedules));
  } catch {
    // Silently ignore storage errors (quota, etc.)
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface UseTaskSchedulerReturn {
  /** All schedules (all statuses). */
  schedules: TaskSchedule[];
  /** Schedules with status 'pending'. */
  pendingSchedules: TaskSchedule[];
  /** Get the schedule for a specific feature (first pending match). */
  getScheduleForFeature: (featureId: string) => TaskSchedule | undefined;
  /** Create a new schedule. */
  createSchedule: (params: {
    featureId: string | 'all-pending';
    triggerAt: string;
    action: ScheduleAction;
  }) => TaskSchedule;
  /** Cancel a pending schedule. */
  cancelSchedule: (scheduleId: string) => void;
  /** Update a schedule's status (e.g. mark missed as triggered). */
  updateScheduleStatus: (scheduleId: string, status: ScheduleStatus) => void;
  /** Delete a schedule entirely. */
  deleteSchedule: (scheduleId: string) => void;
  /** Manually trigger a schedule immediately. */
  triggerNow: (scheduleId: string) => void;
  /** Callback to be set by the consumer for handling triggers. */
  onTrigger: ((schedule: TaskSchedule) => void) | null;
  setOnTrigger: (cb: ((schedule: TaskSchedule) => void) | null) => void;
  /** Format remaining time until trigger. */
  formatCountdown: (triggerAt: string) => string;
}

export function useTaskScheduler(): UseTaskSchedulerReturn {
  const [schedules, setSchedules] = useState<TaskSchedule[]>(() => {
    const loaded = loadSchedules();
    // Check for missed schedules on initial load
    const now = Date.now();
    return loaded.map(s => {
      if (s.status === 'pending' && new Date(s.triggerAt).getTime() <= now) {
        return { ...s, status: 'missed' as ScheduleStatus };
      }
      return s;
    });
  });

  const onTriggerRef = useRef<((schedule: TaskSchedule) => void) | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Persist on every change
  useEffect(() => {
    persistSchedules(schedules);
  }, [schedules]);

  // Background polling: check for schedules to trigger
  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      setSchedules(prev => {
        let changed = false;
        const next = prev.map(s => {
          if (s.status === 'pending' && new Date(s.triggerAt).getTime() <= now) {
            changed = true;
            // Fire trigger callback asynchronously
            const triggered: TaskSchedule = {
              ...s,
              status: 'triggered',
              triggeredAt: new Date().toISOString(),
            };
            if (onTriggerRef.current) {
              // Use setTimeout to avoid state updates during render
              setTimeout(() => onTriggerRef.current?.(triggered), 0);
            }
            return triggered;
          }
          return s;
        });
        return changed ? next : prev;
      });
    };

    // Run once immediately on mount
    tick();

    intervalRef.current = setInterval(tick, POLL_INTERVAL_MS);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  const pendingSchedules = schedules.filter(s => s.status === 'pending');

  const getScheduleForFeature = useCallback(
    (featureId: string): TaskSchedule | undefined =>
      schedules.find(s =>
        (s.featureId === featureId || s.featureId === 'all-pending') && s.status === 'pending'
      ),
    [schedules]
  );

  const createSchedule = useCallback(
    (params: {
      featureId: string | 'all-pending';
      triggerAt: string;
      action: ScheduleAction;
    }): TaskSchedule => {
      const schedule: TaskSchedule = {
        id: generateId(),
        featureId: params.featureId,
        triggerAt: params.triggerAt,
        action: params.action,
        status: 'pending',
        createdAt: new Date().toISOString(),
      };
      setSchedules(prev => [...prev, schedule]);
      return schedule;
    },
    []
  );

  const cancelSchedule = useCallback((scheduleId: string) => {
    setSchedules(prev =>
      prev.map(s =>
        s.id === scheduleId && s.status === 'pending'
          ? { ...s, status: 'cancelled' as ScheduleStatus }
          : s
      )
    );
  }, []);

  const updateScheduleStatus = useCallback(
    (scheduleId: string, status: ScheduleStatus) => {
      setSchedules(prev =>
        prev.map(s =>
          s.id === scheduleId ? { ...s, status } : s
        )
      );
    },
    []
  );

  const deleteSchedule = useCallback((scheduleId: string) => {
    setSchedules(prev => prev.filter(s => s.id !== scheduleId));
  }, []);

  const triggerNow = useCallback((scheduleId: string) => {
    setSchedules(prev =>
      prev.map(s => {
        if (s.id !== scheduleId) return s;
        const triggered: TaskSchedule = {
          ...s,
          status: 'triggered',
          triggeredAt: new Date().toISOString(),
        };
        if (onTriggerRef.current) {
          setTimeout(() => onTriggerRef.current?.(triggered), 0);
        }
        return triggered;
      })
    );
  }, []);

  const setOnTrigger = useCallback(
    (cb: ((schedule: TaskSchedule) => void) | null) => {
      onTriggerRef.current = cb;
    },
    []
  );

  const formatCountdown = useCallback((triggerAt: string): string => {
    const now = Date.now();
    const target = new Date(triggerAt).getTime();
    const diffMs = target - now;

    if (diffMs <= 0) return '';

    const totalMinutes = Math.floor(diffMs / 60_000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      const remHours = hours % 24;
      return `${days}d ${remHours}h`;
    }
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }, []);

  return {
    schedules,
    pendingSchedules,
    getScheduleForFeature,
    createSchedule,
    cancelSchedule,
    updateScheduleStatus,
    deleteSchedule,
    triggerNow,
    onTrigger: onTriggerRef.current,
    setOnTrigger,
    formatCountdown,
  };
}
