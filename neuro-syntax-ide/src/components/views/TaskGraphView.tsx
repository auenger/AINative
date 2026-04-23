import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Network, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { FeatureNode, QueueName } from '../../lib/useQueueData';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CARD_W = 200;
const CARD_H = 82;
const GAP_X = 80;
const GAP_Y = 24;
const PADDING_X = 80;
const PADDING_Y = 60;
const LAYER_LABEL_H = 28;

const STATUS_META: Record<string, { label: string; color: string }> = {
  active:    { label: 'Active',    color: 'bg-primary' },
  pending:   { label: 'Pending',   color: 'bg-secondary' },
  blocked:   { label: 'Blocked',   color: 'bg-[#ffb4ab]' },
  completed: { label: 'Done',      color: 'bg-tertiary' },
};

const STATUS_SVG: Record<string, string> = {
  active:    '#a2c9ff',
  pending:   '#bdf4ff',
  blocked:   '#ffb4ab',
  completed: '#67df70',
};

// ---------------------------------------------------------------------------
// Layout types
// ---------------------------------------------------------------------------

interface LayoutNode {
  id: string;
  feature: FeatureNode;
  queue: QueueName;
  x: number;
  y: number;
  layer: number;
}

interface LayoutEdge {
  from: string;
  to: string;
  fromPos: { x: number; y: number };
  toPos: { x: number; y: number };
}

// ---------------------------------------------------------------------------
// DAG Layout — Simplified Sugiyama
// ---------------------------------------------------------------------------

function computeDAGLayout(features: { feature: FeatureNode; queue: QueueName }[]): {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  layers: LayoutNode[][];
  width: number;
  height: number;
} {
  if (features.length === 0) return { nodes: [], edges: [], layers: [], width: 0, height: 0 };

  const nodeMap = new Map<string, FeatureNode>();
  for (const f of features) nodeMap.set(f.feature.id, f.feature);

  // Step 1: Topological layering — level = max(level[dep]) + 1
  const levels = new Map<string, number>();
  const visited = new Set<string>();

  function getLevel(id: string): number {
    if (levels.has(id)) return levels.get(id)!;
    if (visited.has(id)) return 0; // cycle guard
    visited.add(id);

    const feat = nodeMap.get(id);
    if (!feat || feat.dependencies.length === 0) {
      levels.set(id, 0);
      return 0;
    }

    let maxDepLevel = 0;
    for (const depId of feat.dependencies) {
      if (nodeMap.has(depId)) {
        maxDepLevel = Math.max(maxDepLevel, getLevel(depId) + 1);
      }
    }
    levels.set(id, maxDepLevel);
    return maxDepLevel;
  }

  for (const f of features) getLevel(f.feature.id);

  // Group by layer
  const layerMap = new Map<number, { feature: FeatureNode; queue: QueueName }[]>();
  let maxLayer = 0;
  for (const f of features) {
    const lv = levels.get(f.feature.id) ?? 0;
    maxLayer = Math.max(maxLayer, lv);
    if (!layerMap.has(lv)) layerMap.set(lv, []);
    layerMap.get(lv)!.push(f);
  }

  // Step 2: Sort within layers — by priority desc, then name
  for (const [, items] of layerMap) {
    items.sort((a, b) => b.feature.priority - a.feature.priority || a.feature.name.localeCompare(b.feature.name));
  }

  // Barycenter heuristic (one pass, top-down) to reduce crossings
  for (let lv = 1; lv <= maxLayer; lv++) {
    const items = layerMap.get(lv);
    if (!items) continue;

    items.sort((a, b) => {
      const avgA = avgNeighborLayer(a, lv - 1, levels, layerMap);
      const avgB = avgNeighborLayer(b, lv - 1, levels, layerMap);
      return avgA - avgB;
    });
  }

  // Step 3: Compute coordinates
  const positions = new Map<string, { x: number; y: number }>();
  const layers: LayoutNode[][] = [];

  for (let lv = 0; lv <= maxLayer; lv++) {
    const items = layerMap.get(lv) ?? [];
    const layerNodes: LayoutNode[] = [];
    const totalH = items.length * CARD_H + (items.length - 1) * GAP_Y;

    items.forEach((item, idx) => {
      const x = PADDING_X + lv * (CARD_W + GAP_X);
      const y = PADDING_Y + LAYER_LABEL_H + idx * (CARD_H + GAP_Y);
      positions.set(item.feature.id, { x, y });
      layerNodes.push({
        id: item.feature.id,
        feature: item.feature,
        queue: item.queue,
        x, y, layer: lv,
      });
    });
    layers.push(layerNodes);
  }

  // Compute edges
  const edges: LayoutEdge[] = [];
  for (const f of features) {
    for (const depId of f.feature.dependencies) {
      const fromPos = positions.get(depId);
      const toPos = positions.get(f.feature.id);
      if (!fromPos || !toPos) continue;
      edges.push({
        from: depId,
        to: f.feature.id,
        fromPos: { x: fromPos.x + CARD_W, y: fromPos.y + CARD_H / 2 },
        toPos: { x: toPos.x, y: toPos.y + CARD_H / 2 },
      });
    }
  }

  // Canvas size
  let maxX = 0, maxY = 0;
  for (const [, pos] of positions) {
    maxX = Math.max(maxX, pos.x + CARD_W + PADDING_X);
    maxY = Math.max(maxY, pos.y + CARD_H + PADDING_Y);
  }

  const nodes = layers.flat();

  return { nodes, edges, layers, width: maxX || 800, height: maxY || 400 };
}

function avgNeighborLayer(
  item: { feature: FeatureNode; queue: QueueName },
  targetLayer: number,
  levels: Map<string, number>,
  layerMap: Map<number, { feature: FeatureNode; queue: QueueName }[]>,
): number {
  const neighbors = layerMap.get(targetLayer) ?? [];
  let sum = 0, count = 0;
  for (const n of neighbors) {
    if (item.feature.dependencies.includes(n.feature.id)) {
      const idx = neighbors.indexOf(n);
      sum += idx;
      count++;
    }
  }
  return count > 0 ? sum / count : neighbors.length; // fallback: put at bottom
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
  const cpOffset = Math.max(50, Math.abs(dx) * 0.45);
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

  const layout = useMemo(() => computeDAGLayout(features), [features]);

  // Zoom handler
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.08 : 0.08;
    setZoom(z => Math.min(3, Math.max(0.2, z + delta)));
  }, []);

  // Pan handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('.graph-node')) return;
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

  const handleMouseUp = useCallback(() => setIsPanning(false), []);

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
    const fitZoom = Math.min(scaleX, scaleY, 1.2);
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
    return new Set([hoveredId, ...upstream, ...downstream]);
  }, [hoveredId, layout.edges]);

  const isEdgeHighlighted = useCallback(
    (e: LayoutEdge) => !highlightedIds || (highlightedIds.has(e.from) && highlightedIds.has(e.to)),
    [highlightedIds],
  );

  const isNodeHighlighted = useCallback(
    (id: string) => !highlightedIds || highlightedIds.has(id),
    [highlightedIds],
  );

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
          {Object.entries(STATUS_META).map(([key, val]) => (
            <div key={key} className="flex items-center gap-1.5">
              <span className={cn('w-2 h-2 rounded-full', val.color)} />
              <span className="text-[8px] font-bold uppercase tracking-wider text-on-surface-variant">{val.label}</span>            </div>
          ))}
        </div>
        {/* Zoom controls */}
        <div className="flex items-center gap-1 bg-surface-container-low/90 backdrop-blur-sm border border-outline-variant/10 rounded-lg p-1">
          <button onClick={() => setZoom(z => Math.min(3, z + 0.2))} className="p-1.5 hover:bg-surface-container-high rounded transition-colors" title="Zoom in">
            <ZoomIn size={14} className="text-outline" />
          </button>
          <span className="text-[9px] font-bold text-outline w-10 text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.max(0.2, z - 0.2))} className="p-1.5 hover:bg-surface-container-high rounded transition-colors" title="Zoom out">
            <ZoomOut size={14} className="text-outline" />
          </button>
          <button onClick={resetView} className="p-1.5 hover:bg-surface-container-high rounded transition-colors" title="Reset view">
            <Maximize2 size={14} className="text-outline" />
          </button>
        </div>
      </div>

      {/* Canvas with dot-grid background */}
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden cursor-grab active:cursor-grabbing"
        style={{
          backgroundImage: 'radial-gradient(circle, color-mix(in srgb, var(--t-outline-variant) 20%, transparent) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
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
            <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto" markerUnits="strokeWidth">
              <path d="M 0 0 L 8 3 L 0 6 Z" className="fill-outline-variant/40" />
            </marker>
            <marker id="arrowhead-hl" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto" markerUnits="strokeWidth">
              <path d="M 0 0 L 8 3 L 0 6 Z" className="fill-primary" />
            </marker>
            <filter id="glow">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Layer labels */}
          {layout.layers.map((layer, idx) => {
            if (layer.length === 0) return null;
            const x = PADDING_X + idx * (CARD_W + GAP_X) + CARD_W / 2;
            return (
              <text
                key={`layer-${idx}`}
                x={x}
                y={PADDING_Y + 6}
                textAnchor="middle"
                className="fill-on-surface-variant/40 select-none"
                style={{ fontSize: '10px', fontWeight: 700, fontFamily: 'inherit', letterSpacing: '0.08em', textTransform: 'uppercase' }}
              >
                {idx === 0 ? 'Root' : `Level ${idx}`}
              </text>
            );
          })}

          {/* Edges */}
          {layout.edges.map((e, i) => {
            const hl = isEdgeHighlighted(e);
            return (
              <path
                key={`edge-${i}`}
                d={edgePath(e)}
                fill="none"
                className={cn(
                  'transition-all duration-200',
                  hl ? 'stroke-primary/70 stroke-[1.5]' : 'stroke-outline-variant/15 stroke-1',
                )}
                markerEnd={hl ? 'url(#arrowhead-hl)' : 'url(#arrowhead)'}
                filter={hl ? 'url(#glow)' : undefined}
                style={{ opacity: hl ? 1 : 0.35 }}
              />
            );
          })}

          {/* Nodes — pure SVG cards */}
          {layout.nodes.map(node => {
            const highlighted = isNodeHighlighted(node.id);
            const svgColor = STATUS_SVG[node.queue] || STATUS_SVG.pending;
            const isHovered = hoveredId === node.id;
            const name = node.feature.name.length > 24 ? node.feature.name.slice(0, 24) + '…' : node.feature.name;
            const fid = node.feature.id.length > 22 ? node.feature.id.slice(0, 22) + '…' : node.feature.id;
            return (
              <g
                key={node.id}
                className="graph-node cursor-pointer"
                transform={`translate(${node.x}, ${node.y})`}
                onMouseEnter={() => setHoveredId(node.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() => onNodeClick(node.feature)}
                style={{
                  opacity: highlighted ? 1 : 0.15,
                  transition: 'opacity 0.25s ease',
                }}
              >
                {/* Glow ring on hover */}
                {isHovered && (
                  <rect
                    x={-3}
                    y={-3}
                    width={CARD_W + 6}
                    height={CARD_H + 6}
                    rx={12}
                    fill="none"
                    stroke={svgColor}
                    strokeWidth={1.5}
                    opacity={0.5}
                  />
                )}

                {/* Card shadow */}
                <rect
                  x={2}
                  y={2}
                  width={CARD_W}
                  height={CARD_H}
                  rx={10}
                  fill="rgba(0,0,0,0.15)"
                />

                {/* Card body */}
                <rect
                  width={CARD_W}
                  height={CARD_H}
                  rx={10}
                  className="fill-surface-container-low stroke-outline-variant/20"
                  strokeWidth={1}
                />

                {/* Left status bar */}
                <rect
                  width={4}
                  height={CARD_H - 16}
                  x={6}
                  y={8}
                  rx={2}
                  fill={svgColor}
                  opacity={0.8}
                />

                {/* ID label */}
                <text
                  x={16}
                  y={20}
                  className="fill-on-surface-variant/60 select-none"
                  style={{ fontSize: '8px', fontWeight: 700, fontFamily: 'inherit', letterSpacing: '0.05em' }}
                >
                  {fid}
                </text>

                {/* Size badge — right */}
                <text
                  x={CARD_W - 10}
                  y={20}
                  textAnchor="end"
                  className="fill-on-surface-variant/40 select-none"
                  style={{ fontSize: '8px', fontWeight: 700, fontFamily: 'inherit' }}
                >
                  {node.feature.size || 'M'}
                </text>

                {/* Name */}
                <text
                  x={16}
                  y={40}
                  className="fill-on-surface select-none"
                  style={{ fontSize: '11px', fontWeight: 700, fontFamily: 'inherit' }}
                >
                  {name}
                </text>

                {/* Priority */}
                <text
                  x={16}
                  y={58}
                  className="fill-on-surface-variant/50 select-none"
                  style={{ fontSize: '9px', fontFamily: 'inherit' }}
                >
                  P{node.feature.priority}
                  {node.feature.dependencies.length > 0 && ` · ${node.feature.dependencies.length} dep${node.feature.dependencies.length > 1 ? 's' : ''}`}
                </text>

                {/* Status badge */}
                <rect
                  x={CARD_W - 52}
                  y={48}
                  width={42}
                  height={16}
                  rx={8}
                  fill={svgColor}
                  opacity={0.15}
                />
                <text
                  x={CARD_W - 31}
                  y={59}
                  textAnchor="middle"
                  fill={svgColor}
                  className="select-none"
                  style={{ fontSize: '7.5px', fontWeight: 700, fontFamily: 'inherit', letterSpacing: '0.06em' }}
                >
                  {STATUS_META[node.queue]?.label ?? 'Pending'}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};
