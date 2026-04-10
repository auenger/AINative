/**
 * PixelAgentView — Pixel Office Observatory.
 *
 * Full-screen pixel office showing agents for active Claude Code runtime sessions.
 * Agents route to different activity zones based on their current tool:
 *   - Coding tools (Bash, Write, Edit) → sit at desk, typing animation
 *   - Reading tools (Read, Grep, Glob) → walk to bookshelf / bench area
 *   - Research tools (WebSearch, Task, Agent) → walk to sofa / lounge area
 * Idle agents wander around the office.
 * Demo mode fallback when no runtimes are detected.
 *
 * Tool routing:
 *   - Tauri mode: polls `discover_session_tool` for real Claude Code JSONL data
 *   - Dev mode: simulated tool cycling
 */

import { useEffect, useRef, useState } from 'react';

import { OfficeCanvas } from '../../office/components/OfficeCanvas';
import { OfficeState } from '../../office/engine/officeState';
import { deserializeLayout } from '../../office/layout/layoutSerializer';
import {
  computeActivityZones,
  getToolZone,
  type ActivityZone,
  type ZoneType,
} from '../../office/layout/activityZones';
import { loadAllSprites } from '../../office/sprites/pngLoader';
import type { OfficeLayout } from '../../office/types';
import { useRuntimeMonitor } from '../../lib/useRuntimeMonitor';
import { useWorkspace } from '../../lib/useWorkspace';

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

// ── Types ──────────────────────────────────────────────────────

interface DiscoveredSessionTool {
  session_id: string;
  current_tool: string | null;
  is_active: boolean;
}

// ── Game state lives outside React ─────────────────────────────
const officeStateRef = { current: null as OfficeState | null };

function getOfficeState(): OfficeState {
  if (!officeStateRef.current) {
    officeStateRef.current = new OfficeState();
  }
  return officeStateRef.current;
}

// ── Zone-Aware Agent Routing ───────────────────────────────────

/** All tools an agent might cycle through (simulation fallback) */
const ALL_TOOLS = [
  'Bash', 'Read', 'Write', 'Edit',
  'Grep', 'Glob', 'WebSearch', 'Task',
];

/** Route an agent to the appropriate activity zone based on their tool. */
function routeAgentToZone(
  office: OfficeState,
  agentId: number,
  tool: string,
  zones: Record<ZoneType, ActivityZone>,
): void {
  const ch = office.characters.get(agentId);
  if (!ch) return;

  office.setAgentTool(agentId, tool);

  const zoneType = getToolZone(tool);
  const zoneTiles = zones[zoneType]?.tiles ?? [];

  if (zoneType === 'coding' || zoneTiles.length === 0) {
    // Coding or fallback → return to desk
    ch.workingAtZone = false;
    office.sendToSeat(agentId);
  } else {
    // Walk to the activity zone (bookshelf area / sofa area)
    ch.workingAtZone = true;
    const target = zoneTiles[Math.floor(Math.random() * zoneTiles.length)];
    office.walkToTile(agentId, target.col, target.row);
  }
}

/**
 * Start simulated tool cycling for a single agent (dev / demo mode).
 * Returns the interval handle (for cleanup via clearInterval).
 */
function startToolCycling(
  office: OfficeState,
  agentId: number,
  zones: Record<ZoneType, ActivityZone>,
): ReturnType<typeof setInterval> {
  let currentTool = ALL_TOOLS[Math.floor(Math.random() * ALL_TOOLS.length)];

  // Initial route to zone
  routeAgentToZone(office, agentId, currentTool, zones);

  const interval = setInterval(() => {
    const ch = office.characters.get(agentId);
    if (!ch) return;

    // Don't interrupt mid-walk
    if (ch.state === 'walk') return;

    // Occasionally go idle → agent wanders around
    if (ch.isActive && Math.random() < 0.08) {
      ch.workingAtZone = false;
      office.setAgentActive(agentId, false);
      return;
    }

    // Ensure active
    if (!ch.isActive) {
      office.setAgentActive(agentId, true);
    }

    // Pick a different tool
    let next: string;
    do {
      next = ALL_TOOLS[Math.floor(Math.random() * ALL_TOOLS.length)];
    } while (next === currentTool && ALL_TOOLS.length > 1);

    currentTool = next;
    routeAgentToZone(office, agentId, next, zones);
  }, 8000 + Math.random() * 7000);

  return interval;
}

// ── Layout constants ────────────────────────────────────────────
const MAP_COLS = 21;
const MAP_ROWS = 22;
const TILE_SIZE = 16;
const ZOOM_FACTOR = 1.99;

const PAN_X_FRAC = 0.023;
const PAN_Y_FRAC = -0.18;

function calcZoom(factor: number): number {
  const zoomW = window.innerWidth / (MAP_COLS * TILE_SIZE);
  const zoomH = window.innerHeight / (MAP_ROWS * TILE_SIZE);
  return Math.max(8, Math.floor(Math.max(zoomW, zoomH) * factor));
}

/** Convert a PID to a stable agent ID (offset to avoid collision with demo agents 1,2). */
function pidToAgentId(pid: number): number {
  return pid + 1000;
}

// ── Component ──────────────────────────────────────────────────

export const PixelAgentView: React.FC = () => {
  const [layoutReady, setLayoutReady] = useState(false);
  const [zoom, setZoom] = useState(() => calcZoom(ZOOM_FACTOR));
  const panRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    panRef.current = {
      x: Math.round(PAN_X_FRAC * MAP_COLS * TILE_SIZE * zoom),
      y: Math.round(PAN_Y_FRAC * MAP_ROWS * TILE_SIZE * zoom),
    };
  }, [zoom]);

  useEffect(() => {
    const onResize = () => setZoom(calcZoom(ZOOM_FACTOR));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const simTimersRef = useRef<Map<number, ReturnType<typeof setInterval>>>(new Map());
  const syncedPidsRef = useRef<Set<number>>(new Set());
  const isDemoRef = useRef(false);
  const zonesRef = useRef<Record<ZoneType, ActivityZone> | null>(null);

  const { workspacePath } = useWorkspace();
  const { runtimes, start, stop, hasActiveRuntime } = useRuntimeMonitor();

  // ── Initialize ────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      await loadAllSprites();
      if (!mounted) return;

      let layout: OfficeLayout | null = null;
      try {
        const resp = await fetch('/assets/pixel/default-layout.json');
        if (resp.ok) {
          layout = deserializeLayout(await resp.text());
        }
      } catch {
        // Will use default
      }

      if (!mounted) return;

      const office = getOfficeState();
      if (layout) {
        office.rebuildFromLayout(layout);
      }

      zonesRef.current = computeActivityZones(
        office.layout, office.tileMap, office.blockedTiles,
      );
      console.log('[zones]', Object.fromEntries(
        Object.entries(zonesRef.current).map(([k, v]) => [k, v.tiles.length + ' tiles']),
      ));

      setLayoutReady(true);
    };

    init();
    return () => { mounted = false; };
  }, []);

  // ── Runtime monitoring ────────────────────────────────────────
  useEffect(() => {
    start(workspacePath || '/dev/workspace');
    return () => { stop(); };
  }, [workspacePath, start, stop]);

  // ── Real session tool polling (Tauri only) ────────────────────
  // Reads the latest Claude Code JSONL session to extract the current tool.
  // This drives pixel agent behavior from real data instead of simulation.
  useEffect(() => {
    if (!layoutReady || !zonesRef.current || !isTauri) return;

    const office = getOfficeState();
    const zones = zonesRef.current;
    let lastTool: string | null = null;
    let stopped = false;

    const poll = async () => {
      if (stopped) return;
      // No real agents → nothing to do
      if (syncedPidsRef.current.size === 0) return;

      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const result = await invoke<DiscoveredSessionTool | null>(
          'discover_session_tool',
          { workspacePath: workspacePath || '' },
        );

        if (!result) return;
        const tool = result.current_tool;

        // Tool changed → route all real agents to the new zone
        if (tool && tool !== lastTool) {
          lastTool = tool;
          console.log('[session] real tool:', tool, 'active:', result.is_active);

          for (const pid of syncedPidsRef.current) {
            const id = pidToAgentId(pid);
            const ch = office.characters.get(id);
            if (!ch) continue;
            // Don't interrupt mid-walk
            if (ch.state === 'walk') continue;

            office.setAgentActive(id, true);
            routeAgentToZone(office, id, tool, zones);
          }
        }

        // Session went idle → let agents wander
        if (!result.is_active && lastTool) {
          for (const pid of syncedPidsRef.current) {
            const id = pidToAgentId(pid);
            const ch = office.characters.get(id);
            if (ch && ch.isActive && ch.state !== 'walk') {
              ch.workingAtZone = false;
              office.setAgentActive(id, false);
            }
          }
          lastTool = null;
        }

        // Session active again → reactivate
        if (result.is_active && !lastTool && tool) {
          lastTool = tool;
          for (const pid of syncedPidsRef.current) {
            const id = pidToAgentId(pid);
            const ch = office.characters.get(id);
            if (ch && !ch.isActive) {
              office.setAgentActive(id, true);
              routeAgentToZone(office, id, tool, zones);
            }
          }
        }
      } catch {
        // Ignore — dev mode simulation handles fallback
      }
    };

    poll();
    const interval = setInterval(poll, 6000);
    return () => {
      stopped = true;
      clearInterval(interval);
    };
  }, [layoutReady, workspacePath]);

  // ── Sync agents with runtimes ─────────────────────────────────
  useEffect(() => {
    if (!layoutReady || !zonesRef.current) return;
    const office = getOfficeState();
    const zones = zonesRef.current;
    const activeRuntimes = runtimes.filter(r => r.status && r.status !== 'stopped');

    // No active runtimes → clean up real agents, then start demo mode
    if (activeRuntimes.length === 0) {
      if (!isDemoRef.current) {
        // Clean up all real agents and their simulation timers
        for (const [, timer] of simTimersRef.current) clearInterval(timer);
        simTimersRef.current.clear();
        for (const pid of syncedPidsRef.current) {
          const id = pidToAgentId(pid);
          office.removeAgent(id);
        }
        syncedPidsRef.current.clear();

        // Transition to demo mode
        isDemoRef.current = true;
        const a1 = 1, a2 = 2;
        office.addAgent(a1, 0, undefined, undefined, true);
        office.addAgent(a2, 1, 45, undefined, true);
        office.setAgentActive(a1, true);
        office.setAgentActive(a2, true);
        simTimersRef.current.set(a1, startToolCycling(office, a1, zones));
        simTimersRef.current.set(a2, startToolCycling(office, a2, zones));
      }
      return;
    }

    // Stop demo mode
    if (isDemoRef.current) {
      console.log('[sync] Stopping demo mode');
      for (const [, timer] of simTimersRef.current) clearInterval(timer);
      simTimersRef.current.clear();
      office.removeAgent(1);
      office.removeAgent(2);
      isDemoRef.current = false;
      syncedPidsRef.current.clear();
    }

    const currentPids = new Set(syncedPidsRef.current);
    const runtimePids = new Set(activeRuntimes.map(r => r.pid));

    // Add new agents
    for (const rt of activeRuntimes) {
      const id = pidToAgentId(rt.pid);

      if (!currentPids.has(rt.pid)) {
        if (!office.characters.has(id)) {
          office.addAgent(id, undefined, undefined, undefined, true);
          office.setAgentActive(id, true);

          // Only start simulation in dev mode.
          // In Tauri mode, the real session polling drives tool routing.
          if (!isTauri) {
            simTimersRef.current.set(id, startToolCycling(office, id, zones));
          } else {
            // Initial placement at desk
            routeAgentToZone(office, id, 'Bash', zones);
          }

          console.log('[sync] Added agent:', id, 'pid:', rt.pid);
        }
        syncedPidsRef.current.add(rt.pid);
      } else if (!isTauri) {
        // Dev mode: sync active state from runtime status
        const ch = office.characters.get(id);
        if (ch && ch.isActive !== (rt.status === 'running')) {
          office.setAgentActive(id, rt.status === 'running');
        }
      }
      // Tauri: active state is managed by session polling, not CPU status
    }

    // Remove stale agents
    for (const pid of currentPids) {
      if (!runtimePids.has(pid)) {
        const id = pidToAgentId(pid);
        const timer = simTimersRef.current.get(id);
        if (timer) clearInterval(timer);
        simTimersRef.current.delete(id);
        office.removeAgent(id);
        syncedPidsRef.current.delete(pid);
      }
    }
  }, [runtimes, hasActiveRuntime, layoutReady]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      for (const [, timer] of simTimersRef.current) clearInterval(timer);
      simTimersRef.current.clear();
    };
  }, []);

  // ── Render ────────────────────────────────────────────────────
  if (!layoutReady) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#1a1a2e]">
        <span className="text-slate-400 font-mono text-sm">Loading office...</span>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative overflow-hidden">
      <OfficeCanvas
        officeState={getOfficeState()}
        onClick={() => {}}
        zoom={zoom}
        onZoomChange={() => {}}
        panRef={panRef}
      />

      {/* Vignette overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'var(--vignette)' }}
      />
    </div>
  );
};
