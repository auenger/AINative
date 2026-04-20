/**
 * PixelAgentView — Pixel Office Observatory.
 *
 * Full-screen pixel office showing agents for active Claude Code runtime sessions.
 * Agents route to different activity zones based on their current tool:
 *   - Coding tools (Bash, Write, Edit) → sit at desk, typing animation
 *   - Reading tools (Read, Grep, Glob) → walk to bookshelf / bench area
 *   - Research tools (WebSearch, Task, Agent) → walk to sofa / lounge area
 * Idle agents wander around the office.
 *
 * Driven by real-time JSONL session events from the Tauri backend.
 * Dev mode uses simulated events through the same interface.
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
import { useClaudeSessionWatcher } from '../../lib/useClaudeSessionWatcher';
import { useWorkspace } from '../../lib/useWorkspace';

// ── Game state lives outside React ─────────────────────────────
const officeStateRef = { current: null as OfficeState | null };

function getOfficeState(): OfficeState {
  if (!officeStateRef.current) {
    officeStateRef.current = new OfficeState();
  }
  return officeStateRef.current;
}

// ── Zone-Aware Agent Routing ───────────────────────────────────

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
    ch.workingAtZone = false;
    office.sendToSeat(agentId);
  } else {
    ch.workingAtZone = true;
    const target = zoneTiles[Math.floor(Math.random() * zoneTiles.length)];
    office.walkToTile(agentId, target.col, target.row);
  }
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

/** Convert a session ID string to a stable numeric agent ID. */
function sessionIdToAgentId(sessionId: string): number {
  let hash = 0;
  for (let i = 0; i < sessionId.length; i++) {
    hash = ((hash << 5) - hash + sessionId.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) + 2000;
}

// ── Component ──────────────────────────────────────────────────

export const PixelAgentView: React.FC = () => {
  const [layoutReady, setLayoutReady] = useState(false);
  const [zoom, setZoom] = useState(() => calcZoom(ZOOM_FACTOR));
  const panRef = useRef({ x: 0, y: 0 });
  const zonesRef = useRef<Record<ZoneType, ActivityZone> | null>(null);
  const prevSessionIdsRef = useRef<Set<string>>(new Set());

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

  const { workspacePath } = useWorkspace();
  const { sessions, start: startWatching, stop: stopWatching } = useClaudeSessionWatcher();

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

      setLayoutReady(true);
    };

    init();
    return () => { mounted = false; };
  }, []);

  // ── Start/stop session watcher ────────────────────────────────
  useEffect(() => {
    startWatching(workspacePath || '/dev/workspace');
    return () => { stopWatching(); };
  }, [workspacePath, startWatching, stopWatching]);

  // ── Sync agents with session events ───────────────────────────
  useEffect(() => {
    if (!layoutReady || !zonesRef.current) return;
    const office = getOfficeState();
    const zones = zonesRef.current;

    const currentSessionIds = new Set<string>();

    for (const [sessionId, tracked] of sessions) {
      currentSessionIds.add(sessionId);
      const agentId = sessionIdToAgentId(sessionId);

      // Ensure agent exists
      if (!office.characters.has(agentId)) {
        office.addAgent(agentId, undefined, undefined, undefined, false);
        office.setAgentActive(agentId, true);
      }

      const ch = office.characters.get(agentId);
      if (!ch || ch.matrixEffect) continue;

      // Route based on active tools
      if (tracked.active_tool_ids.size > 0 && !tracked.is_waiting) {
        // Get the latest active tool name
        const latestTool = tracked.active_tool_names.values().next().value;
        if (latestTool && (ch.state !== 'walk' || ch.currentTool !== latestTool)) {
          if (!ch.isActive) office.setAgentActive(agentId, true);
          routeAgentToZone(office, agentId, latestTool, zones);
        }
      }

      // Turn ended → idle
      if (tracked.is_waiting && ch.isActive && ch.state !== 'walk') {
        ch.workingAtZone = false;
        office.setAgentActive(agentId, false);
      }

      // Handle sub-agents
      for (const [parentToolId, subTools] of tracked.subagent_tools) {
        const subKey = `${agentId}:${parentToolId}`;
        const existingSubId = office.getSubagentId(agentId, parentToolId);

        if (subTools.size > 0 && !existingSubId) {
          const subId = office.addSubagent(agentId, parentToolId);
          // Route sub-agent to the zone of its current tool
          const subToolName = subTools.values().next().value;
          if (subToolName) {
            office.setAgentActive(subId, true);
            routeAgentToZone(office, subId, subToolName, zones);
          }
        } else if (subTools.size > 0 && existingSubId) {
          // Update sub-agent tool
          const subToolName = subTools.values().next().value;
          if (subToolName) {
            const subCh = office.characters.get(existingSubId);
            if (subCh && !subCh.matrixEffect) {
              office.setAgentTool(existingSubId, subToolName);
            }
          }
        }
      }

      // Clear sub-agents that are no longer tracked
      // (handled by subagent_clear events processed in the hook)
    }

    // Remove agents for lost sessions
    for (const prevId of prevSessionIdsRef.current) {
      if (!currentSessionIds.has(prevId)) {
        const agentId = sessionIdToAgentId(prevId);
        if (office.characters.has(agentId)) {
          office.removeAllSubagents(agentId);
          office.removeAgent(agentId);
        }
      }
    }

    prevSessionIdsRef.current = currentSessionIds;
  }, [sessions, layoutReady]);

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
