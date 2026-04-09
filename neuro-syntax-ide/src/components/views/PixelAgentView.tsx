/**
 * PixelAgentView — Observatory Tab entry component.
 *
 * Manages OfficeState, game loop, and integrates with the runtime monitor
 * to reflect Claude Code Agent states as pixel characters.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Eye, Plus, Minus, RotateCcw } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useRuntimeMonitor } from '../../lib/useRuntimeMonitor';
import { OfficeState } from '../../office/engine/pixelOfficeState';
import { startGameLoop } from '../../office/engine/pixelGameLoop';
import { renderFrame } from '../../office/engine/pixelRenderer';
import { deserializeLayout } from '../../office/layout/pixelLayoutSerializer';
import { loadCharacterSprites } from '../../office/sprites/pixelSpriteData';
import { useWorkspace } from '../../lib/useWorkspace';
import type { PixelAgentStatus } from '../../office/pixelTypes';

// Agent status display labels
const STATUS_LABELS: Record<PixelAgentStatus, string> = {
  typing: 'Agent is typing...',
  reading: 'Agent is reading...',
  writing: 'Agent is writing code...',
  command: 'Agent is running commands...',
  processing: 'Agent is processing...',
  waiting: 'Agent is waiting for input',
  idle: 'Agent is idle',
  offline: 'No active agent',
};

export const PixelAgentView: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const officeRef = useRef<OfficeState | null>(null);
  const offsetRef = useRef({ x: 0, y: 0 });
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ mouseX: 0, mouseY: 0, panX: 0, panY: 0 });
  const panRef = useRef({ x: 0, y: 0 });
  const zoomRef = useRef(Math.round(2 * (window.devicePixelRatio || 1)));
  const [zoom, setZoom] = useState(zoomRef.current);
  const [agentStatus, setAgentStatus] = useState<PixelAgentStatus>('offline');
  const [assetsLoaded, setAssetsLoaded] = useState(false);
  const isActiveRef = useRef(true);

  const { workspacePath } = useWorkspace();
  const { runtimes, isMonitoring, start, stop } = useRuntimeMonitor();

  // Track which runtime processes correspond to which agent IDs
  const agentMapRef = useRef<Map<number, { pid: number; lastActivity: number }>>(new Map());
  const lastActivityRef = useRef<Map<number, number>>(new Map());

  // Initialize office and load assets
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      // Load layout
      let layout = null;
      try {
        const resp = await fetch('/assets/pixel/default-layout.json');
        if (resp.ok) {
          const json = await resp.text();
          layout = deserializeLayout(json);
        }
      } catch {
        // Layout fetch failed, will use default
      }

      if (!mounted) return;
      const office = new OfficeState(layout ?? undefined);
      officeRef.current = office;

      // Load character sprites
      try {
        const loaded = await loadCharacterSprites();
        if (mounted) setAssetsLoaded(loaded);
      } catch {
        // Use fallback sprites
        if (mounted) setAssetsLoaded(false);
      }
    };

    init();

    return () => { mounted = false; };
  }, []);

  // Start runtime monitor and track agent processes
  useEffect(() => {
    if (workspacePath && !isMonitoring) {
      start(workspacePath);
    }
    return () => {
      // Don't stop the monitor — it's shared
    };
  }, [workspacePath, isMonitoring, start]);

  // Sync runtime processes with office characters
  useEffect(() => {
    const office = officeRef.current;
    if (!office) return;

    const activePids = new Set<number>();

    for (const runtime of runtimes) {
      if (runtime.runtime_id === 'claude-code' && runtime.status === 'running') {
        activePids.add(runtime.pid);

        if (!agentMapRef.current.has(runtime.pid)) {
          // New agent — spawn character
          const agentId = runtime.pid; // Use PID as agent ID
          agentMapRef.current.set(runtime.pid, { pid: runtime.pid, lastActivity: Date.now() });
          lastActivityRef.current.set(runtime.pid, Date.now());
          office.addAgent(agentId);
          office.setAgentActive(agentId, true);
        } else {
          // Existing agent — check activity
          const agentId = runtime.pid;
          office.setAgentActive(agentId, true);
        }
      }
    }

    // Remove agents for processes that no longer exist
    for (const [pid] of agentMapRef.current) {
      if (!activePids.has(pid)) {
        const agentId = pid;
        office.setAgentActive(agentId, false);
        office.removeAgent(agentId);
        agentMapRef.current.delete(pid);
        lastActivityRef.current.delete(pid);
      }
    }

    // Update agent status text
    if (activePids.size > 0) {
      setAgentStatus('typing'); // Default to typing when running
    } else {
      setAgentStatus('offline');
    }
  }, [runtimes]);

  // Simulate periodic agent status changes for visual demo
  // In production, this would be driven by Tauri events from Rust backend
  useEffect(() => {
    const office = officeRef.current;
    if (!office) return;

    const tools = ['Read', 'Write', 'Bash', 'Grep', 'Glob', 'Edit'];
    let toolIndex = 0;

    const timer = setInterval(() => {
      const characters = office.getCharacters();
      if (characters.length === 0) return;

      const ch = characters[0];
      const statuses: PixelAgentStatus[] = ['typing', 'reading', 'writing', 'command', 'processing', 'idle'];
      const status = statuses[toolIndex % statuses.length];
      toolIndex++;

      // Set tool
      if (status === 'reading') {
        office.setAgentTool(ch.id, 'Read');
        setAgentStatus('reading');
      } else if (status === 'writing') {
        office.setAgentTool(ch.id, 'Write');
        setAgentStatus('writing');
      } else if (status === 'command') {
        office.setAgentTool(ch.id, 'Bash');
        setAgentStatus('command');
      } else if (status === 'processing') {
        office.setAgentTool(ch.id, null);
        setAgentStatus('processing');
      } else if (status === 'idle') {
        office.setAgentActive(ch.id, false);
        office.setAgentTool(ch.id, null);
        setAgentStatus('idle');
        // Re-activate after a moment
        setTimeout(() => {
          office.setAgentActive(ch.id, true);
          setAgentStatus('typing');
        }, 3000);
      } else {
        office.setAgentTool(ch.id, null);
        setAgentStatus('typing');
      }
    }, 8000);

    return () => clearInterval(timer);
  }, [assetsLoaded]);

  // Canvas resize
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
  }, []);

  // Game loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const office = officeRef.current;
    if (!canvas || !office) return;

    resizeCanvas();

    const observer = new ResizeObserver(() => resizeCanvas());
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    const stopLoop = startGameLoop(canvas, {
      update: (dt) => {
        if (isActiveRef.current) {
          office.update(dt);
        }
      },
      render: (ctx) => {
        if (!isActiveRef.current) return;
        const w = canvas.width;
        const h = canvas.height;

        const { offsetX, offsetY } = renderFrame(
          ctx,
          w,
          h,
          office.tileMap,
          office.furniture,
          office.getCharacters(),
          zoomRef.current,
          panRef.current.x,
          panRef.current.y,
          office.selectedAgentId,
          office.hoveredAgentId,
        );
        offsetRef.current = { x: offsetX, y: offsetY };
      },
    });

    return () => {
      stopLoop();
      observer.disconnect();
    };
  }, [assetsLoaded, resizeCanvas]);

  // Tab visibility: pause rendering when not visible
  useEffect(() => {
    isActiveRef.current = true;
    return () => {
      isActiveRef.current = false;
    };
  }, []);

  // Mouse handlers
  const screenToWorld = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const deviceX = (clientX - rect.left) * dpr;
    const deviceY = (clientY - rect.top) * dpr;
    const worldX = (deviceX - offsetRef.current.x) / zoomRef.current;
    const worldY = (deviceY - offsetRef.current.y) / zoomRef.current;
    return { worldX, worldY, deviceX, deviceY };
  }, []);

  const handleClick = useCallback((e: React.MouseEvent) => {
    const office = officeRef.current;
    if (!office) return;
    const pos = screenToWorld(e.clientX, e.clientY);
    if (!pos) return;

    const hitId = office.getCharacterAt(pos.worldX, pos.worldY);
    if (hitId !== null) {
      if (office.selectedAgentId === hitId) {
        office.selectedAgentId = null;
      } else {
        office.selectedAgentId = hitId;
      }
    } else {
      office.selectedAgentId = null;
    }
  }, [screenToWorld]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanningRef.current) {
      const dpr = window.devicePixelRatio || 1;
      const dx = (e.clientX - panStartRef.current.mouseX) * dpr;
      const dy = (e.clientY - panStartRef.current.mouseY) * dpr;
      panRef.current = {
        x: panStartRef.current.panX + dx,
        y: panStartRef.current.panY + dy,
      };
      return;
    }

    const office = officeRef.current;
    if (!office) return;
    const pos = screenToWorld(e.clientX, e.clientY);
    if (!pos) return;
    office.hoveredAgentId = office.getCharacterAt(pos.worldX, pos.worldY);
  }, [screenToWorld]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1) {
      e.preventDefault();
      isPanningRef.current = true;
      panStartRef.current = {
        mouseX: e.clientX,
        mouseY: e.clientY,
        panX: panRef.current.x,
        panY: panRef.current.y,
      };
    }
  }, []);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (e.button === 1) {
      isPanningRef.current = false;
    }
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      const delta = e.deltaY < 0 ? 1 : -1;
      const newZoom = Math.max(1, Math.min(10, zoomRef.current + delta));
      if (newZoom !== zoomRef.current) {
        zoomRef.current = newZoom;
        setZoom(newZoom);
      }
    } else {
      const dpr = window.devicePixelRatio || 1;
      panRef.current = {
        x: panRef.current.x - e.deltaX * dpr,
        y: panRef.current.y - e.deltaY * dpr,
      };
    }
  }, []);

  const handleZoomIn = useCallback(() => {
    const newZoom = Math.min(10, zoomRef.current + 1);
    zoomRef.current = newZoom;
    setZoom(newZoom);
  }, []);

  const handleZoomOut = useCallback(() => {
    const newZoom = Math.max(1, zoomRef.current - 1);
    zoomRef.current = newZoom;
    setZoom(newZoom);
  }, []);

  const handleZoomReset = useCallback(() => {
    zoomRef.current = Math.round(2 * (window.devicePixelRatio || 1));
    setZoom(zoomRef.current);
    panRef.current = { x: 0, y: 0 };
  }, []);

  const characters = officeRef.current?.getCharacters() ?? [];
  const hasAgents = characters.length > 0;

  return (
    <div className="flex flex-col h-full w-full bg-[#1a1a2e] relative overflow-hidden">
      {/* Canvas container */}
      <div ref={containerRef} className="flex-1 relative overflow-hidden">
        <canvas
          ref={canvasRef}
          onClick={handleClick}
          onMouseMove={handleMouseMove}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onWheel={handleWheel}
          onContextMenu={(e) => e.preventDefault()}
          className="block w-full h-full cursor-crosshair"
        />

        {/* No agent overlay */}
        {!hasAgents && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="flex flex-col items-center gap-3 opacity-50">
              <Eye size={48} className="text-slate-400" />
              <p className="text-slate-400 text-sm font-mono">No active agent</p>
              <p className="text-slate-500 text-xs font-mono">
                Start a Claude Code session to see the pixel agent
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Zoom controls */}
      <div className="absolute top-3 right-3 flex flex-col gap-1">
        <button
          onClick={handleZoomIn}
          className="w-8 h-8 flex items-center justify-center bg-[#2a2a3e]/90 border border-slate-600/50 text-slate-300 hover:bg-[#3a3a4e] hover:text-white transition-colors rounded-sm"
          title="Zoom In"
        >
          <Plus size={14} />
        </button>
        <div className="text-center text-[10px] font-mono text-slate-400 py-0.5">
          {zoom}x
        </div>
        <button
          onClick={handleZoomOut}
          className="w-8 h-8 flex items-center justify-center bg-[#2a2a3e]/90 border border-slate-600/50 text-slate-300 hover:bg-[#3a3a4e] hover:text-white transition-colors rounded-sm"
          title="Zoom Out"
        >
          <Minus size={14} />
        </button>
        <button
          onClick={handleZoomReset}
          className="w-8 h-8 flex items-center justify-center bg-[#2a2a3e]/90 border border-slate-600/50 text-slate-300 hover:bg-[#3a3a4e] hover:text-white transition-colors rounded-sm mt-1"
          title="Reset View"
        >
          <RotateCcw size={12} />
        </button>
      </div>

      {/* Bottom status bar */}
      <div className="h-8 bg-[#252538] border-t border-slate-700/50 flex items-center px-4 gap-3 shrink-0">
        <div className={cn(
          'w-2 h-2 rounded-full',
          agentStatus === 'offline' ? 'bg-slate-500' : 'bg-green-400 animate-pulse'
        )} />
        <span className="text-[11px] font-mono text-slate-400">
          {STATUS_LABELS[agentStatus]}
        </span>
        {hasAgents && (
          <span className="text-[10px] font-mono text-slate-500 ml-auto">
            {characters.length} agent{characters.length !== 1 ? 's' : ''} | scroll to pan, ctrl+scroll to zoom
          </span>
        )}
      </div>
    </div>
  );
};
