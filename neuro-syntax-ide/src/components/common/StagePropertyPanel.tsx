import React, { useState } from 'react';
import {
  Trash2,
  ChevronUp,
  ChevronDown,
  Plus,
  Info,
  Activity,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import type { PipelineStageConfig, AgentRuntimeInfo } from '../../types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface StagePropertyPanelProps {
  /** The current stage configuration. */
  stage: PipelineStageConfig;
  /** Index of this stage in the pipeline. */
  stageIndex: number;
  /** Available agent runtimes. */
  runtimes: AgentRuntimeInfo[];
  /** Total number of stages in the pipeline. */
  totalStages: number;
  /** Update handler. */
  onUpdate: (updates: Partial<PipelineStageConfig>) => void;
  /** Delete handler. */
  onDelete: () => void;
  /** Move handler. */
  onMove: (direction: 'up' | 'down') => void;
}

// ---------------------------------------------------------------------------
// StagePropertyPanel component
// ---------------------------------------------------------------------------

export const StagePropertyPanel: React.FC<StagePropertyPanelProps> = ({
  stage,
  stageIndex,
  runtimes,
  totalStages,
  onUpdate,
  onDelete,
  onMove,
}) => {
  const [showMappingHelp, setShowMappingHelp] = useState(false);

  const availableRuntimes = runtimes.filter(r => r.status === 'available');

  // --- Input mapping helpers ---
  const inputMappingEntries = Object.entries(stage.input_mapping ?? {});

  const handleAddMapping = () => {
    const key = `key_${inputMappingEntries.length + 1}`;
    onUpdate({
      input_mapping: { ...(stage.input_mapping ?? {}), [key]: '' },
    });
  };

  const handleUpdateMappingKey = (oldKey: string, newKey: string) => {
    const mapping = { ...(stage.input_mapping ?? {}) };
    const value = mapping[oldKey];
    delete mapping[oldKey];
    mapping[newKey] = value;
    onUpdate({ input_mapping: mapping });
  };

  const handleUpdateMappingValue = (key: string, value: string) => {
    onUpdate({
      input_mapping: { ...(stage.input_mapping ?? {}), [key]: value },
    });
  };

  const handleDeleteMapping = (key: string) => {
    const mapping = { ...(stage.input_mapping ?? {}) };
    delete mapping[key];
    onUpdate({ input_mapping: mapping });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-outline-variant/10">
        <div className="flex items-center justify-between">
          <h2 className="font-headline text-xs font-bold uppercase tracking-widest text-on-surface-variant">
            Stage Properties
          </h2>
          <span className="text-[10px] text-primary font-mono">#{stageIndex + 1}</span>
        </div>
        <p className="text-[10px] text-on-surface-variant mt-1">
          Configure stage parameters
        </p>
      </div>

      {/* Scrollable form */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5 scroll-hide">
        {/* Stage ID */}
        <label className="block">
          <span className="text-[10px] font-bold text-outline uppercase tracking-tighter">
            Stage ID
          </span>
          <input
            type="text"
            value={stage.id}
            onChange={e => onUpdate({ id: e.target.value })}
            placeholder="stage-id"
            className="mt-1 w-full bg-surface-container-lowest border border-outline-variant/30 text-xs text-on-surface p-2 rounded-sm focus:ring-1 focus:ring-primary focus:outline-none font-mono"
          />
        </label>

        {/* Stage Name */}
        <label className="block">
          <span className="text-[10px] font-bold text-outline uppercase tracking-tighter">
            Stage Name
          </span>
          <input
            type="text"
            value={stage.name}
            onChange={e => onUpdate({ name: e.target.value })}
            placeholder="Analysis Stage"
            className="mt-1 w-full bg-surface-container-lowest border border-outline-variant/30 text-xs text-on-surface p-2 rounded-sm focus:ring-1 focus:ring-primary focus:outline-none"
          />
        </label>

        {/* Runtime selection */}
        <label className="block">
          <span className="text-[10px] font-bold text-outline uppercase tracking-tighter">
            Runtime
          </span>
          <select
            value={stage.runtime_id}
            onChange={e => onUpdate({ runtime_id: e.target.value })}
            className="mt-1 w-full bg-surface-container-lowest border border-outline-variant/30 text-xs text-on-surface p-2 rounded-sm focus:ring-1 focus:ring-primary focus:outline-none"
          >
            <option value="">Select a runtime...</option>
            {availableRuntimes.map(rt => (
              <option key={rt.id} value={rt.id}>{rt.name}</option>
            ))}
          </select>
          {stage.runtime_id && (
            <div className="mt-1 flex items-center gap-1">
              <div className={cn(
                'w-1.5 h-1.5 rounded-full',
                runtimes.find(r => r.id === stage.runtime_id)?.status === 'available'
                  ? 'bg-tertiary'
                  : 'bg-outline',
              )} />
              <span className="text-[9px] text-on-surface-variant font-mono">
                {runtimes.find(r => r.id === stage.runtime_id)?.name ?? stage.runtime_id}
              </span>
            </div>
          )}
        </label>

        {/* Prompt Template */}
        <label className="block">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-outline uppercase tracking-tighter">
              Prompt Template
            </span>
            <span className="text-[8px] text-primary font-mono">
              {'{{input}} {{prev_output}}'}
            </span>
          </div>
          <textarea
            value={stage.prompt_template}
            onChange={e => onUpdate({ prompt_template: e.target.value })}
            rows={5}
            placeholder="Enter prompt template. Use {{input}} for initial input, {{prev_output}} for previous stage output..."
            className="mt-1 w-full bg-surface-container-lowest border border-outline-variant/30 text-xs text-on-surface p-2 rounded-sm focus:ring-1 focus:ring-primary focus:outline-none font-mono resize-y"
          />
        </label>

        {/* Input Mapping */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold text-outline uppercase tracking-tighter">
              Input Mapping
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowMappingHelp(!showMappingHelp)}
                className="p-0.5 text-on-surface-variant hover:text-primary transition-colors"
              >
                <Info size={10} />
              </button>
              <button
                onClick={handleAddMapping}
                className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-primary hover:bg-primary/10 px-1.5 py-0.5 rounded-sm transition-colors"
              >
                <Plus size={10} />
                Add
              </button>
            </div>
          </div>

          {showMappingHelp && (
            <div className="mb-2 p-2 bg-primary/5 border border-primary/10 rounded-sm text-[9px] text-on-surface-variant">
              Input mappings define key-value pairs available as template variables. Use {'{{key}}'} in the prompt template to reference them.
            </div>
          )}

          {inputMappingEntries.length === 0 ? (
            <p className="text-[10px] text-on-surface-variant opacity-50">
              No input mappings. Add key-value pairs for template variables.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {inputMappingEntries.map(([key, value]) => (
                <div key={key} className="flex items-center gap-1">
                  <input
                    type="text"
                    value={key}
                    onChange={e => handleUpdateMappingKey(key, e.target.value)}
                    className="w-24 bg-surface-container-lowest border border-outline-variant/30 text-[10px] p-1.5 rounded-sm font-mono text-on-surface-variant focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                  <span className="text-outline text-[10px]">=</span>
                  <input
                    type="text"
                    value={value}
                    onChange={e => handleUpdateMappingValue(key, e.target.value)}
                    className="flex-1 bg-surface-container-lowest border border-outline-variant/30 text-[10px] p-1.5 rounded-sm font-mono text-on-surface focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                  <button
                    onClick={() => handleDeleteMapping(key)}
                    className="p-1 text-error/40 hover:text-error transition-colors shrink-0"
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Numeric fields */}
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-[10px] font-bold text-outline uppercase tracking-tighter">
              Max Retries
            </span>
            <input
              type="number"
              min={0}
              max={10}
              value={stage.max_retries ?? 0}
              onChange={e => onUpdate({ max_retries: parseInt(e.target.value) || 0 })}
              className="mt-1 w-full bg-surface-container-lowest border border-outline-variant/30 text-xs text-on-surface p-2 rounded-sm focus:ring-1 focus:ring-primary focus:outline-none font-mono"
            />
          </label>
          <label className="block">
            <span className="text-[10px] font-bold text-outline uppercase tracking-tighter">
              Timeout (s)
            </span>
            <input
              type="number"
              min={0}
              max={3600}
              value={stage.timeout_seconds ?? 60}
              onChange={e => onUpdate({ timeout_seconds: parseInt(e.target.value) || 60 })}
              className="mt-1 w-full bg-surface-container-lowest border border-outline-variant/30 text-xs text-on-surface p-2 rounded-sm focus:ring-1 focus:ring-primary focus:outline-none font-mono"
            />
          </label>
        </div>

        {/* Order controls */}
        <div className="pt-2 border-t border-outline-variant/10">
          <span className="text-[10px] font-bold text-outline uppercase tracking-tighter block mb-2">
            Stage Order
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onMove('up')}
              disabled={stageIndex === 0}
              className={cn(
                'flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-sm border transition-colors',
                stageIndex === 0
                  ? 'border-outline-variant/10 text-outline cursor-not-allowed'
                  : 'border-outline-variant/30 text-on-surface-variant hover:border-primary/50 hover:text-primary',
              )}
            >
              <ChevronUp size={12} />
              Up
            </button>
            <button
              onClick={() => onMove('down')}
              disabled={stageIndex === totalStages - 1}
              className={cn(
                'flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-sm border transition-colors',
                stageIndex === totalStages - 1
                  ? 'border-outline-variant/10 text-outline cursor-not-allowed'
                  : 'border-outline-variant/30 text-on-surface-variant hover:border-primary/50 hover:text-primary',
              )}
            >
              <ChevronDown size={12} />
              Down
            </button>
          </div>
        </div>
      </div>

      {/* Delete stage button */}
      <div className="p-4 border-t border-outline-variant/10 bg-surface-container-lowest">
        <button
          onClick={onDelete}
          className="w-full flex items-center justify-center gap-1.5 py-2 text-[10px] font-bold uppercase tracking-wider text-error/60 hover:text-error hover:bg-error/10 rounded-sm transition-colors"
        >
          <Trash2 size={12} />
          Delete Stage
        </button>
      </div>
    </div>
  );
};
