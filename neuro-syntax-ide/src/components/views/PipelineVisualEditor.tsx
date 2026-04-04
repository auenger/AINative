import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize,
  Plus,
  Trash2,
  GripVertical,
  ChevronRight,
  ChevronDown,
  Save,
  X,
  Settings2,
  Activity,
  ArrowRight,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import type {
  PipelineConfig,
  PipelineStageConfig,
  AgentRuntimeInfo,
} from '../../types';
import { StagePropertyPanel } from '../common/StagePropertyPanel';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Position of a node on the canvas. */
interface NodePosition {
  x: number;
  y: number;
}

/** Extended stage config with position for the visual canvas. */
interface VisualStageNode {
  stage: PipelineStageConfig;
  position: NodePosition;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NODE_WIDTH = 200;
const NODE_HEIGHT = 80;
const NODE_GAP_X = 280;
const NODE_GAP_Y = 160;
const GRID_SIZE = 20;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generate a stage id. */
function genStageId(index: number): string {
  return `stage-${index + 1}`;
}

/** Calculate default positions for stages (horizontal layout). */
function layoutStages(count: number, canvasCenter: { x: number; y: number }): NodePosition[] {
  const startX = canvasCenter.x - ((count - 1) * NODE_GAP_X) / 2;
  const startY = canvasCenter.y;
  return Array.from({ length: count }, (_, i) => ({
    x: startX + i * NODE_GAP_X,
    y: startY,
  }));
}

/** Build SVG path for a connection between two nodes. */
function buildConnectionPath(
  from: NodePosition,
  to: NodePosition,
): string {
  const x1 = from.x + NODE_WIDTH;
  const y1 = from.y + NODE_HEIGHT / 2;
  const x2 = to.x;
  const y2 = to.y + NODE_HEIGHT / 2;
  const cx = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`;
}

// ---------------------------------------------------------------------------
// StageNodeCard component
// ---------------------------------------------------------------------------

interface StageNodeCardProps {
  node: VisualStageNode;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onDragStart: (e: React.MouseEvent) => void;
}

const StageNodeCard: React.FC<StageNodeCardProps> = ({
  node,
  index,
  isSelected,
  onSelect,
  onDragStart,
}) => {
  return (
    <div
      className={cn(
        'absolute w-[200px] bg-surface-container-high border-l-4 shadow-2xl rounded-sm z-10 cursor-grab active:cursor-grabbing select-none',
        isSelected ? 'border-primary ring-2 ring-primary/40' : 'border-secondary',
      )}
      style={{
        left: node.position.x,
        top: node.position.y,
      }}
      onMouseDown={(e) => {
        onSelect();
        onDragStart(e);
      }}
    >
      <div className="p-3">
        {/* Header */}
        <div className="flex items-center gap-2 mb-2">
          <Activity size={14} className={isSelected ? 'text-primary' : 'text-secondary'} />
          <span className="text-[10px] font-black font-headline uppercase tracking-tighter text-on-surface truncate">
            {node.stage.name || `Stage ${index + 1}`}
          </span>
        </div>

        {/* Meta */}
        <div className="flex items-center gap-2 text-[9px] text-on-surface-variant">
          <GripVertical size={10} className="text-outline" />
          <span className="font-mono truncate">{node.stage.id}</span>
        </div>

        {/* Runtime badge */}
        <div className="mt-2 flex items-center gap-1">
          <div className={cn(
            'text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded',
            node.stage.runtime_id
              ? 'bg-primary/10 text-primary'
              : 'bg-surface-container-highest text-outline',
          )}>
            {node.stage.runtime_id || 'No Runtime'}
          </div>
        </div>
      </div>

      {/* Connection port (right side) */}
      <div className="absolute top-1/2 -right-2 w-4 h-4 bg-secondary rounded-full border-2 border-surface-container-high transform -translate-y-1/2 z-20" />
      {/* Connection port (left side) */}
      {index > 0 && (
        <div className="absolute top-1/2 -left-2 w-4 h-4 bg-primary rounded-full border-2 border-surface-container-high transform -translate-y-1/2 z-20" />
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// StageTemplateLibrary (left sidebar)
// ---------------------------------------------------------------------------

interface StageTemplateLibraryProps {
  onAddStage: () => void;
}

const StageTemplateLibrary: React.FC<StageTemplateLibraryProps> = ({ onAddStage }) => {
  return (
    <aside className="w-56 bg-surface-container-low flex flex-col border-r border-outline-variant/10">
      <div className="p-4 border-b border-outline-variant/10">
        <h2 className="font-headline text-xs font-bold uppercase tracking-widest text-on-surface-variant">
          Stage Templates
        </h2>
        <p className="text-[10px] text-outline mt-1">Drag or click to add stages</p>
      </div>

      <div className="p-2 flex flex-col gap-1 overflow-y-auto scroll-hide">
        {/* Template items */}
        {[
          { label: 'Analysis Stage', desc: 'Analyze input data' },
          { label: 'Processing Stage', desc: 'Transform & process' },
          { label: 'Review Stage', desc: 'Review & validate' },
          { label: 'Output Stage', desc: 'Generate final output' },
        ].map((tmpl) => (
          <button
            key={tmpl.label}
            onClick={onAddStage}
            className="flex items-center gap-3 p-2 hover:bg-surface-container-high rounded cursor-grab group text-left transition-colors"
          >
            <Activity size={14} className="text-secondary" />
            <div>
              <span className="text-xs font-medium text-on-surface-variant block">{tmpl.label}</span>
              <span className="text-[9px] text-outline">{tmpl.desc}</span>
            </div>
            <GripVertical size={10} className="ml-auto opacity-0 group-hover:opacity-100 text-outline" />
          </button>
        ))}
      </div>

      <div className="mt-auto p-4 border-t border-outline-variant/10">
        <button
          onClick={onAddStage}
          className="w-full py-2 border border-dashed border-outline-variant text-[10px] font-bold uppercase tracking-tighter text-outline hover:text-primary hover:border-primary transition-colors flex items-center justify-center gap-1"
        >
          <Plus size={12} />
          Add Stage
        </button>
      </div>
    </aside>
  );
};

// ---------------------------------------------------------------------------
// Props for PipelineVisualEditor
// ---------------------------------------------------------------------------

export interface PipelineVisualEditorProps {
  /** Existing pipeline config to edit (null = create new). */
  initialConfig: PipelineConfig | null;
  /** Available agent runtimes for the runtime selector. */
  runtimes: AgentRuntimeInfo[];
  /** Save handler. */
  onSave: (config: PipelineConfig) => void;
  /** Delete handler. */
  onDelete?: (id: string) => void;
  /** Cancel handler. */
  onCancel: () => void;
}

// ---------------------------------------------------------------------------
// PipelineVisualEditor component
// ---------------------------------------------------------------------------

export const PipelineVisualEditor: React.FC<PipelineVisualEditorProps> = ({
  initialConfig,
  runtimes,
  onSave,
  onDelete,
  onCancel,
}) => {
  // --- Pipeline metadata state ---
  const [pipelineId, setPipelineId] = useState(initialConfig?.id ?? '');
  const [pipelineName, setPipelineName] = useState(initialConfig?.name ?? '');
  const [pipelineDescription, setPipelineDescription] = useState(initialConfig?.description ?? '');
  const [variables, setVariables] = useState<Record<string, string>>(initialConfig?.variables ?? {});

  // --- Canvas state ---
  const canvasRef = useRef<HTMLDivElement>(null);
  const [selectedStageIndex, setSelectedStageIndex] = useState<number | null>(null);
  const [nodes, setNodes] = useState<VisualStageNode[]>(() => {
    if (!initialConfig?.stages.length) return [];
    const center = { x: 400, y: 200 };
    const positions = layoutStages(initialConfig.stages.length, center);
    return initialConfig.stages.map((stage, i) => ({
      stage: { ...stage },
      position: positions[i],
    }));
  });

  // --- Drag state ---
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState<NodePosition>({ x: 0, y: 0 });

  // --- Zoom state ---
  const [zoom, setZoom] = useState(1);

  // --- Form validation ---
  const isNew = !initialConfig;

  // --- Reorder helper ---
  const swapStages = useCallback((fromIdx: number, toIdx: number) => {
    setNodes(prev => {
      const next = [...prev];
      if (fromIdx < toIdx) {
        for (let i = fromIdx; i < toIdx; i++) {
          [next[i], next[i + 1]] = [next[i + 1], next[i]];
        }
      } else {
        for (let i = fromIdx; i > toIdx; i--) {
          [next[i], next[i - 1]] = [next[i - 1], next[i]];
        }
      }
      return next;
    });
  }, []);

  // --- Drag handlers ---
  const handleDragStart = useCallback((index: number, e: React.MouseEvent) => {
    const node = nodes[index];
    if (!node) return;
    setDraggingIndex(index);
    setDragOffset({
      x: e.clientX - node.position.x,
      y: e.clientY - node.position.y,
    });
  }, [nodes]);

  useEffect(() => {
    if (draggingIndex === null) return;

    const handleMouseMove = (e: MouseEvent) => {
      setNodes(prev => {
        const next = [...prev];
        if (next[draggingIndex]) {
          next[draggingIndex] = {
            ...next[draggingIndex],
            position: {
              x: Math.max(0, e.clientX - dragOffset.x),
              y: Math.max(0, e.clientY - dragOffset.y),
            },
          };
        }
        return next;
      });
    };

    const handleMouseUp = () => {
      setDraggingIndex(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingIndex, dragOffset]);

  // --- Add stage ---
  const handleAddStage = useCallback(() => {
    const newIndex = nodes.length;
    const newStage: PipelineStageConfig = {
      id: genStageId(newIndex),
      name: `Stage ${newIndex + 1}`,
      runtime_id: '',
      prompt_template: '{{input}}',
      input_mapping: {},
      max_retries: 0,
      timeout_seconds: 60,
    };

    // Position the new node after the last one
    const lastPos = nodes.length > 0
      ? nodes[nodes.length - 1].position
      : { x: 100, y: 200 };
    const newPos = {
      x: lastPos.x + NODE_GAP_X,
      y: lastPos.y,
    };

    setNodes(prev => [...prev, { stage: newStage, position: newPos }]);
    setSelectedStageIndex(newIndex);
  }, [nodes]);

  // --- Delete stage ---
  const handleDeleteStage = useCallback((index: number) => {
    setNodes(prev => prev.filter((_, i) => i !== index));
    setSelectedStageIndex(prev => {
      if (prev === null) return null;
      if (prev === index) return null;
      if (prev > index) return prev - 1;
      return prev;
    });
  }, []);

  // --- Update stage config ---
  const handleUpdateStage = useCallback((index: number, updates: Partial<PipelineStageConfig>) => {
    setNodes(prev => {
      const next = [...prev];
      if (next[index]) {
        next[index] = {
          ...next[index],
          stage: { ...next[index].stage, ...updates },
        };
      }
      return next;
    });
  }, []);

  // --- Move stage up/down ---
  const handleMoveStage = useCallback((index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= nodes.length) return;
    swapStages(index, targetIndex);
    setSelectedStageIndex(targetIndex);
  }, [nodes.length, swapStages]);

  // --- Variable management ---
  const handleAddVariable = useCallback(() => {
    const key = `var_${Object.keys(variables).length + 1}`;
    setVariables(prev => ({ ...prev, [key]: '' }));
  }, [variables]);

  const handleUpdateVariable = useCallback((key: string, newKey: string, value: string) => {
    setVariables(prev => {
      const next: Record<string, string> = {};
      for (const [k, v] of Object.entries(prev)) {
        if (k === key) {
          next[newKey] = value;
        } else {
          next[k] = v;
        }
      }
      return next;
    });
  }, []);

  const handleDeleteVariable = useCallback((key: string) => {
    setVariables(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  // --- Save ---
  const handleSave = useCallback(() => {
    if (!pipelineId.trim() || !pipelineName.trim()) return;

    const config: PipelineConfig = {
      id: pipelineId.trim(),
      name: pipelineName.trim(),
      description: pipelineDescription.trim() || undefined,
      stages: nodes.map(n => n.stage),
      variables: Object.keys(variables).length > 0 ? variables : undefined,
    };

    onSave(config);
  }, [pipelineId, pipelineName, pipelineDescription, nodes, variables, onSave]);

  // --- Auto-relayout ---
  const handleAutoLayout = useCallback(() => {
    setNodes(prev => {
      const center = { x: 400, y: 200 };
      const positions = layoutStages(prev.length, center);
      return prev.map((node, i) => ({
        ...node,
        position: positions[i],
      }));
    });
  }, []);

  // --- Canvas center for calculating default layout ---
  const canvasCenter = canvasRef.current
    ? { x: canvasRef.current.clientWidth / 2 - NODE_WIDTH / 2, y: canvasRef.current.clientHeight / 2 - NODE_HEIGHT / 2 }
    : { x: 400, y: 200 };

  // Auto-layout on first render if initial stages exist
  useEffect(() => {
    if (initialConfig?.stages.length) {
      const center = canvasCenter;
      const positions = layoutStages(initialConfig.stages.length, center);
      setNodes(prev => prev.map((node, i) => ({
        ...node,
        position: positions[i],
      })));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedNode = selectedStageIndex !== null ? nodes[selectedStageIndex] : null;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* === Top bar: Pipeline metadata + actions === */}
      <div className="bg-surface-container-low border-b border-outline-variant/10 px-4 py-3 flex items-center gap-4 shrink-0">
        <div className="flex items-center gap-2">
          <Activity size={16} className="text-primary" />
          <span className="font-headline text-xs font-bold uppercase tracking-widest text-on-surface-variant">
            {isNew ? 'New Pipeline' : 'Edit Pipeline'}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-1">
          <input
            type="text"
            placeholder="Pipeline ID (kebab-case)"
            value={pipelineId}
            onChange={e => setPipelineId(e.target.value)}
            disabled={!isNew}
            className={cn(
              'w-48 bg-surface-container-lowest border border-outline-variant/30 text-xs text-on-surface p-1.5 rounded-sm focus:ring-1 focus:ring-primary focus:outline-none font-mono',
              !isNew && 'opacity-60 cursor-not-allowed',
            )}
          />
          <input
            type="text"
            placeholder="Pipeline Name"
            value={pipelineName}
            onChange={e => setPipelineName(e.target.value)}
            className="flex-1 max-w-xs bg-surface-container-lowest border border-outline-variant/30 text-xs text-on-surface p-1.5 rounded-sm focus:ring-1 focus:ring-primary focus:outline-none"
          />
          <input
            type="text"
            placeholder="Description (optional)"
            value={pipelineDescription}
            onChange={e => setPipelineDescription(e.target.value)}
            className="flex-1 bg-surface-container-lowest border border-outline-variant/30 text-xs text-on-surface p-1.5 rounded-sm focus:ring-1 focus:ring-primary focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleAutoLayout}
            className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant hover:bg-surface-container-high rounded-sm transition-colors"
            title="Auto Layout"
          >
            <Maximize size={12} />
            Layout
          </button>
          <button
            onClick={onCancel}
            className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant hover:bg-surface-container-high rounded-sm transition-colors"
          >
            <X size={12} />
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!pipelineId.trim() || !pipelineName.trim() || nodes.length === 0}
            className={cn(
              'flex items-center gap-1 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-sm transition-all',
              pipelineId.trim() && pipelineName.trim() && nodes.length > 0
                ? 'bg-primary text-on-primary hover:brightness-110'
                : 'bg-surface-container-highest text-outline cursor-not-allowed',
            )}
          >
            <Save size={12} />
            Save Pipeline
          </button>
        </div>
      </div>

      {/* === Main content: 3-column layout === */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Stage template library */}
        <StageTemplateLibrary onAddStage={handleAddStage} />

        {/* Center: Canvas */}
        <section
          ref={canvasRef}
          className="flex-1 relative overflow-hidden cursor-crosshair"
          style={{
            backgroundImage: `
              linear-gradient(to right, var(--color-outline-variant, rgba(255,255,255,0.06)) 1px, transparent 1px),
              linear-gradient(to bottom, var(--color-outline-variant, rgba(255,255,255,0.06)) 1px, transparent 1px)
            `,
            backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px`,
          }}
        >
          {/* Zoom controls */}
          <div className="absolute top-4 left-4 z-20 flex gap-2">
            <div className="bg-surface-container-highest/80 backdrop-blur-md p-1 rounded-sm flex gap-1 border border-outline-variant/20 shadow-xl">
              <button
                onClick={() => setZoom(z => Math.min(2, z + 0.1))}
                className="p-1 hover:bg-primary-container/20 text-on-surface-variant rounded-sm"
              >
                <ZoomIn size={14} />
              </button>
              <button
                onClick={() => setZoom(z => Math.max(0.5, z - 0.1))}
                className="p-1 hover:bg-primary-container/20 text-on-surface-variant rounded-sm"
              >
                <ZoomOut size={14} />
              </button>
              <div className="w-[1px] bg-outline-variant/30 my-1" />
              <button
                onClick={handleAutoLayout}
                className="p-1 hover:bg-primary-container/20 text-on-surface-variant rounded-sm"
              >
                <Maximize size={14} />
              </button>
            </div>
            <div className="bg-surface-container-highest/80 backdrop-blur-md px-3 py-1 rounded-sm border border-outline-variant/20 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-tertiary" />
              <span className="font-headline text-[10px] font-bold uppercase tracking-wider">
                {nodes.length} Stage{nodes.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {/* Canvas content (with zoom transform) */}
          <div
            className="absolute inset-0"
            style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
          >
            {/* SVG Connection lines */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
              {nodes.slice(0, -1).map((node, i) => {
                const nextNode = nodes[i + 1];
                if (!nextNode) return null;
                return (
                  <g key={`conn-${i}`}>
                    <path
                      d={buildConnectionPath(node.position, nextNode.position)}
                      fill="none"
                      stroke="var(--color-primary, #00e3fd)"
                      strokeWidth="2"
                      className="filter drop-shadow-[0_0_4px_rgba(0,227,253,0.4)]"
                    />
                    {/* Arrow head at midpoint */}
                    <circle
                      cx={(node.position.x + NODE_WIDTH + nextNode.position.x) / 2}
                      cy={(node.position.y + NODE_HEIGHT / 2 + nextNode.position.y + NODE_HEIGHT / 2) / 2}
                      r="3"
                      fill="var(--color-primary, #00e3fd)"
                    />
                  </g>
                );
              })}
            </svg>

            {/* Stage nodes */}
            {nodes.map((node, i) => (
              <div key={`node-${node.stage.id}`} className="relative">
                <StageNodeCard
                  node={node}
                  index={i}
                  isSelected={selectedStageIndex === i}
                  onSelect={() => setSelectedStageIndex(i)}
                  onDragStart={(e) => handleDragStart(i, e)}
                />
                {/* Delete button (visible on hover/selection) */}
                {selectedStageIndex === i && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteStage(i);
                    }}
                    className="absolute z-30 p-1 bg-error/80 text-on-primary rounded-full hover:bg-error transition-colors"
                    style={{
                      left: node.position.x + NODE_WIDTH - 8,
                      top: node.position.y - 8,
                    }}
                    title="Delete Stage"
                  >
                    <Trash2 size={10} />
                  </button>
                )}
              </div>
            ))}

            {/* Empty state */}
            {nodes.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center text-on-surface-variant opacity-40">
                  <Activity size={48} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-medium">No stages yet</p>
                  <p className="text-[10px] mt-1">Click "Add Stage" in the left panel to get started</p>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Right: Property panel */}
        <aside className="w-72 bg-surface-container-low border-l border-outline-variant/10 flex flex-col shrink-0">
          {selectedNode ? (
            <StagePropertyPanel
              stage={selectedNode.stage}
              stageIndex={selectedStageIndex!}
              runtimes={runtimes}
              totalStages={nodes.length}
              onUpdate={(updates) => handleUpdateStage(selectedStageIndex!, updates)}
              onDelete={() => handleDeleteStage(selectedStageIndex!)}
              onMove={(direction) => handleMoveStage(selectedStageIndex!, direction)}
            />
          ) : (
            <>
              {/* No stage selected: show Variables config */}
              <div className="p-4 border-b border-outline-variant/10">
                <h2 className="font-headline text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                  Properties
                </h2>
                <p className="text-[10px] text-outline mt-1">Select a stage to edit, or configure global variables below</p>
              </div>

              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 scroll-hide">
                {/* Global Variables */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold text-outline uppercase tracking-tighter">
                      Global Variables
                    </span>
                    <button
                      onClick={handleAddVariable}
                      className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-primary hover:bg-primary/10 px-1.5 py-0.5 rounded-sm transition-colors"
                    >
                      <Plus size={10} />
                      Add
                    </button>
                  </div>
                  {Object.entries(variables).length === 0 ? (
                    <p className="text-[10px] text-on-surface-variant opacity-50">
                      No global variables. These are available as {'{{var_name}}'} in all stage prompts.
                    </p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {Object.entries(variables).map(([key, value]) => (
                        <div key={key} className="flex items-center gap-1">
                          <input
                            type="text"
                            value={key}
                            onChange={e => handleUpdateVariable(key, e.target.value, value)}
                            className="w-24 bg-surface-container-lowest border border-outline-variant/30 text-[10px] p-1.5 rounded-sm font-mono text-on-surface-variant focus:ring-1 focus:ring-primary focus:outline-none"
                          />
                          <ArrowRight size={10} className="text-outline shrink-0" />
                          <input
                            type="text"
                            value={value}
                            onChange={e => handleUpdateVariable(key, key, e.target.value)}
                            className="flex-1 bg-surface-container-lowest border border-outline-variant/30 text-[10px] p-1.5 rounded-sm font-mono text-on-surface focus:ring-1 focus:ring-primary focus:outline-none"
                          />
                          <button
                            onClick={() => handleDeleteVariable(key)}
                            className="p-1 text-error/40 hover:text-error transition-colors shrink-0"
                          >
                            <Trash2 size={10} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Pipeline Summary */}
                <div className="mt-4 pt-4 border-t border-outline-variant/10">
                  <span className="text-[10px] font-bold text-outline uppercase tracking-tighter block mb-2">
                    Pipeline Summary
                  </span>
                  <div className="space-y-1 text-[10px] text-on-surface-variant">
                    <div className="flex justify-between">
                      <span>Stages:</span>
                      <span className="font-mono">{nodes.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Variables:</span>
                      <span className="font-mono">{Object.keys(variables).length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Runtimes used:</span>
                      <span className="font-mono">
                        {new Set(nodes.map(n => n.stage.runtime_id).filter(Boolean)).size}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Delete pipeline button */}
          {!isNew && onDelete && (
            <div className="p-4 border-t border-outline-variant/10 bg-surface-container-lowest">
              <button
                onClick={() => {
                  if (confirm('Are you sure you want to delete this pipeline?')) {
                    onDelete(initialConfig!.id);
                  }
                }}
                className="w-full flex items-center justify-center gap-1.5 py-2 text-[10px] font-bold uppercase tracking-wider text-error/60 hover:text-error hover:bg-error/10 rounded-sm transition-colors"
              >
                <Trash2 size={12} />
                Delete Pipeline
              </button>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};
