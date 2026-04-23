import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Network, ZoomIn, ZoomOut, Maximize2, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import type { FeatureNode, QueueName } from '../../lib/useQueueData';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NODE_W = 180;
const NODE_H = 72;
const NODE_GAP_X = 60;
const NODE_GAP_Y = 30;
const PADDING = 60;

const STATUS_COLORS: Record<string, { bg: string; border: string; dot: string; label: string }> = {
  active:    { bg: 'fill-primary/20',  border: 'stroke-primary/50',  dot: 'fill-primary',  label: 'Active' },
  pending:   { bg: 'fill-secondary/20', border: 'stroke-secondary/50', dot: 'fill-secondary', label: 'Pending' },
  blocked:   { bg: 'fill-[#ffb4ab]/20', border: 'stroke-[#ffb4ab]/50', dot: 'fill-[#ffb4ab]', label: 'Blocked' },
  completed: { bg: 'fill-tertiary/20', border: 'stroke-tertiary/50', dot: 'fill-tertiary', label: 'Completed' },
};

const PRIORITY_BORDER: Record<string, string> = {
  high:   'stroke-primary stroke-2',
  medium: 'stroke-secondary stroke-[1.5]',
  low:    'stroke-tertiary stroke-1',
};

function priorityClass(p: number) {
  if (p >= 70) return PRIORITY_BORDER.high;
  if (p >= 40) return PRIORITY_BORDER.medium;
  return PRIORITY_BORDER.low;
}

function sizeLabel(s: string) {
  return s || 'M';
}

// ---------------------------------------------------------------------------
// Layout types
// ---------------------------------------------------------------------------

interface LayoutNode {
  id: string;
  feature: FeatureNode;
  queue: QueueName;
  x: number;
  y: number;
}

interface LayoutEdge {
  from: string;
  to: string;
  fromPos: { x: number; y: number };
  toPos: { x: number; y: number };
}

// ---------------------------------------------------------------------------
// Layout algorithm
// ---------------------------------------------------------------------------

function computeLayout(features: { feature: FeatureNode; queue: QueueName }[]): {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  width: number;
  height: number;
} {
  if (features.length === 0) return { nodes: [], edges: [], width: 0, height: 0 };

  const nodeMap = new Map<string, { feature: FeatureNode; queue: QueueName }>();
  for (const f of features) nodeMap.set(f.feature.id, f);

  // Sort by queue priority (active > pending > blocked > completed), then by priority desc, then id
  const queueOrder: Record<QueueName, number> = { active: 0, pending: 1, blocked: 2, completed: 3 };
  const sorted = [...features].sort((a, b) => {
    const qa = queueOrder[a.queue];
    const qb = queueOrder[b.queue];
    if (qa !== qb) return qa - qb;
    return b.feature.priority - a.feature.priority;
  });

  // Time-axis: group completed by completed_at, others by creation order
  // For layout, use completed_at for completed features, otherwise index
  const timeSlots = new Map<number, string[]>();

  for (const item of sorted) {
    const f = item.feature;
    let slot: number;
    if (f.completed_at) {
      slot = new Date(f.completed_at).getTime();
    } else {
      slot = 1e15 - f.priority * 1e10 + (f.id.charCodeAt(0) || 0);
    }
    const existing = timeSlots.get(slot);
    if (existing) existing.push(f.id);
    else timeSlots.set(slot, [f.id]);
  }

  // Assign positions
  const positions = new Map<string, { x: number; y: number }>();
  const sortedSlots = [...timeSlots.entries()].sort((a, b) => a[0] - b[0]);

  sortedSlots.forEach(([, ids], colIdx) => {
    ids.forEach((id, rowIdx) => {
      positions.set(id, {
        x: PADDING + colIdx * (NODE_W + NODE_GAP_X),
        y: PADDING + rowIdx * (NODE_H + NODE_GAP_Y),
      });
    });
  });

  // Compute edges from dependencies
  const edges: LayoutEdge[] = [];
  for (const f of features) {
    for (const depId of f.feature.dependencies) {
      if (!positions.has(depId)) continue;
      const from = positions.get(depId)!;
      const to = positions.get(f.feature.id)!;
      edges.push({
        from: depId,
        to: f.feature.id,
        fromPos: { x: from.x + NODE_W, y: from.y + NODE_H / 2 },
        toPos: { x: to.x, y: to.y + NODE_H / 2 },
      });
    }
  }

  // Compute canvas size
  let maxX = 0, maxY = 0;
  for (const [, pos] of positions) {
    maxX = Math.max(maxX, pos.x + NODE_W + PADDING);
    maxY = Math.max(maxY, pos.y + NODE_H + PADDING);
  }

  const nodes: LayoutNode[] = features.map(f => ({
    id: f.feature.id,
    feature: f.feature,
    queue: f.queue,
    x: positions.get(f.feature.id)?.x ?? 0,
    y: positions.get(f.feature.id)?.y ?? 0,
  }));

  return { nodes, edges, width: maxX, height: maxY };
}

// ---------------------------------------------------------------------------
// Dependency chain helpers
// ---------------------------------------------------------------------------

function getUpstream(nodeId: string, edges: LayoutEdge[]): Set<string> {
  const result = new Set<string>();
  const queue = [nodeId];
  while (queue.length > 0) {
    const cur = queue.pop()!;
    for (const e of edges) {
      if (e.to === cur && !result.has(e.from)) {
        result.add(e.from);
        queue.push(e.from);
      }
    }
  }
  return result;
}

function getDownstream(nodeId: string, edges: LayoutEdge[]): Set<string> {
  const result = new Set<string>();
  const queue = [nodeId];
  while (queue.length > 0) {
    const cur = queue.pop()!;
    for (const e of edges) {
      if (e.from === cur && !result.has(e.to)) {
        result.add(e.to);
        queue.push(e.to);
      }
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// SVG Edge path
// ---------------------------------------------------------------------------

function edgePath(e: LayoutEdge): string {
  const dx = e.toPos.x - e.fromPos.x;
  const cpOffset = Math.max(40, Math.abs(dx) * 0.4);
  return `M ${e.fromPos.x} ${e.fromPos.y} C ${e.fromPos.x + cpOffset} ${e.fromPos.y}, ${e.toPos.x - cpOffset} ${e.toPos.y}, ${e.toPos.x} ${e.toPos.y}`;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TaskGraphViewProps {
  features: { feature: FeatureNode; queue: QueueName }[];
  onNodeClick: (f: FeatureNode) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const TaskGraphView: React.FC<TaskGraphViewProps> = ({ features, onNodeClick }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const layout = useMemo(() => computeLayout(features), [features]);

  // Zoom handler
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom(z => Math.min(3, Math.max(0.2, z + delta)));
  }, []);

  // Pan handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    // Only pan on background
    if ((e.target as SVGElement).closest('.graph-node')) return;
    setIsPanning(true);
    panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning) return;
    setPan({
      x: panStart.current.panX + (e.clientX - panStart.current.x),
      y: panStart.current.panY + (e.clientY - panStart.current.y),
    });
  }, [isPanning]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Reset view
  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  // Fit to container on mount
  useEffect(() => {
    if (!containerRef.current || layout.width === 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    const scaleX = (rect.width - 40) / layout.width;
    const scaleY = (rect.height - 40) / layout.height;
    const fitZoom = Math.min(scaleX, scaleY, 1.5);
    if (fitZoom < 1) {
      setZoom(fitZoom);
      setPan({ x: 20, y: 20 });
    }
  }, [layout.width, layout.height]);

  // Dependency chain highlighting
  const highlightedIds = useMemo(() => {
    if (!hoveredId) return null;
    const upstream = getUpstream(hoveredId, layout.edges);
    const downstream = getDownstream(hoveredId, layout.edges);
    const chain = new Set([hoveredId, ...upstream, ...downstream]);
    return chain;
  }, [hoveredId, layout.edges]);

  const isEdgeHighlighted = useCallback((e: LayoutEdge) => {
    if (!highlightedIds) return true;
    return highlightedIds.has(e.from) && highlightedIds.has(e.to);
  }, [highlightedIds]);

  const isNodeHighlighted = useCallback((id: string) => {
    if (!highlightedIds) return true;
    return highlightedIds.has(id);
  }, [highlightedIds]);

  // Empty state
  if (features.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-outline opacity-60">
          <Network size={48} strokeWidth={1} />
          <div className="text-center">
            <p className="text-sm font-bold uppercase tracking-widest mb-1">No Tasks</p>
            <p className="text-[10px] text-on-surface-variant">Create tasks to see their dependency graph</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative">
      {/* Toolbar */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
        {/* Legend */}
        <div className="flex items-center gap-3 bg-surface-container-low/90 backdrop-blur-sm border border-outline-variant/10 rounded-lg px-3 py-1.5">
          {Object.entries(STATUS_COLORS).map(([key, val]) => (
            <div key={key} className="flex items-center gap-1.5">
              <span className={cn("w-2 h-2 rounded-full", val.dot.replace('fill-', 'bg-'))} />
              <span className="text-[8px] font-bold uppercase tracking-wider text-on-surface-variant">{val.label}</span>
            </div>
          ))}
        </div>
        {/* Zoom controls */}
        <div className="flex items-center gap-1 bg-surface-container-low/90 backdrop-blur-sm border border-outline-variant/10 rounded-lg p-1">
          <button
            onClick={() => setZoom(z => Math.min(3, z + 0.2))}
            className="p-1.5 hover:bg-surface-container-high rounded transition-colors"
            title="Zoom in"
          >
            <ZoomIn size={14} className="text-outline" />
          </button>
          <span className="text-[9px] font-bold text-outline w-10 text-center">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom(z => Math.max(0.2, z - 0.2))}
            className="p-1.5 hover:bg-surface-container-high rounded transition-colors"
            title="Zoom out"
          >
            <ZoomOut size={14} className="text-outline" />
          </button>
          <button
            onClick={resetView}
            className="p-1.5 hover:bg-surface-container-high rounded transition-colors"
            title="Reset view"
          >
            <Maximize2 size={14} className="text-outline" />
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden cursor-grab active:cursor-grabbing"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <svg
          width={layout.width}
          height={layout.height}
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
            transition: isPanning ? 'none' : 'transform 0.15s ease-out',
          }}
        >
          <defs>
            <marker
              id="arrowhead"
              markerWidth="8"
              markerHeight="6"
              refX="7"
              refY="3"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <path d="M 0 0 L 8 3 L 0 6 Z" fill="currentColor" className="text-outline-variant" />
            </marker>
            <marker
              id="arrowhead-highlight"
              markerWidth="8"
              markerHeight="6"
              refX="7"
              refY="3"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <path d="M 0 0 L 8 3 L 0 6 Z" fill="currentColor" className="text-primary" />
            </marker>
          </defs>

          {/* Edges */}
          {layout.edges.map((e, i) => {
            const highlighted = isEdgeHighlighted(e);
            return (
              <path
                key={`edge-${i}`}
                d={edgePath(e)}
                fill="none"
                className={cn(
                  'transition-opacity duration-200',
                  highlighted
                    ? 'stroke-primary/60 stroke-[1.5]'
                    : 'stroke-outline-variant/20 stroke-1',
                )}
                markerEnd={highlighted ? 'url(#arrowhead-highlight)' : 'url(#arrowhead)'}
                style={{ opacity: highlighted ? 1 : 0.3 }}
              />
            );
          })}

          {/* Nodes */}
          {layout.nodes.map(node => {
            const highlighted = isNodeHighlighted(node.id);
            const status = STATUS_COLORS[node.queue] || STATUS_COLORS.pending;
            return (
              <g
                key={node.id}
                className="graph-node cursor-pointer"
                transform={`translate(${node.x}, ${node.y})`}
                onMouseEnter={() => setHoveredId(node.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() => onNodeClick(node.feature)}
                style={{
                  opacity: highlighted ? 1 : 0.2,
                  transition: 'opacity 0.2s ease',
                }}
              >
                {/* Node background */}
                <rect
                  width={NODE_W}
                  height={NODE_H}
                  rx={10}
                  className={cn(
                    status.bg,
                    priorityClass(node.feature.priority),
                    'transition-all duration-200',
                  )}
                  strokeDasharray={node.queue === 'completed' ? 'none' : undefined}
                />

                {/* Status dot */}
                <circle
                  cx={14}
                  cy={14}
                  r={4}
                  className={status.dot}
                />

                {/* ID label */}
                <text
                  x={24}
                  y={17}
                  className="fill-outline text-[9px] font-bold uppercase"
                  style={{ fontFamily: 'inherit' }}
                >
                  {node.feature.id.length > 20 ? node.feature.id.slice(0, 20) + '…' : node.feature.id}
                </text>

                {/* Size badge */}
                <text
                  x={NODE_W - 14}
                  y={17}
                  className="fill-on-surface-variant text-[8px] font-bold uppercase"
                  textAnchor="end"
                  style={{ fontFamily: 'inherit' }}
                >
                  {sizeLabel(node.feature.size)}
                </text>

                {/* Name */}
                <text
                  x={14}
                  y={38}
                  className="fill-on-surface text-[11px] font-bold"
                  style={{ fontFamily: 'inherit' }}
                >
                  {node.feature.name.length > 22 ? node.feature.name.slice(0, 22) + '…' : node.feature.name}
                </text>

                {/* Priority + deps */}
                <text
                  x={14}
                  y={56}
                  className="fill-on-surface-variant text-[9px]"
                  style={{ fontFamily: 'inherit' }}
                >
                  P{node.feature.priority}
                  {node.feature.dependencies.length > 0 && ` · ${node.feature.dependencies.length} dep${node.feature.dependencies.length > 1 ? 's' : ''}`}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};
