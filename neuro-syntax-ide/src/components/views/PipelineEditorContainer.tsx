import React, { useState, useEffect } from 'react';
import {
  Save,
  X,
  Eye,
  FileText,
  FileJson,
  AlertCircle,
  CheckCircle2,
  Trash2,
  Activity,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useTranslation } from 'react-i18next';
import {
  usePipelineDualMode,
  fromYaml,
  fromJson,
  type EditorMode,
  type ValidationError,
} from '../../lib/usePipelineDualMode';
import { PipelineVisualEditor } from './PipelineVisualEditor';
import { PipelineTextEditor } from './PipelineTextEditor';
import type { PipelineConfig, AgentRuntimeInfo } from '../../types';

// ---------------------------------------------------------------------------
// Mode Button
// ---------------------------------------------------------------------------

interface ModeButtonProps {
  mode: EditorMode;
  currentMode: EditorMode;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}

const ModeButton: React.FC<ModeButtonProps> = ({
  mode,
  currentMode,
  onClick,
  icon,
  label,
}) => (
  <button
    onClick={onClick}
    className={cn(
      'flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-sm transition-all',
      currentMode === mode
        ? 'bg-primary text-on-primary'
        : 'text-on-surface-variant hover:text-on-surface',
    )}
  >
    {icon}
    {label}
  </button>
);

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PipelineEditorContainerProps {
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
  /** Initial editor mode. Defaults to 'visual'. */
  initialMode?: EditorMode;
}

// ---------------------------------------------------------------------------
// PipelineEditorContainer component
// ---------------------------------------------------------------------------

export const PipelineEditorContainer: React.FC<PipelineEditorContainerProps> = ({
  initialConfig,
  runtimes,
  onSave,
  onDelete,
  onCancel,
  initialMode = 'visual',
}) => {
  const { t } = useTranslation();
  const dualMode = usePipelineDualMode({ initialConfig });
  const [switchError, setSwitchError] = useState<string | null>(null);
  const isNew = !initialConfig;

  // Initialize to the requested mode
  useEffect(() => {
    if (initialMode !== 'visual') {
      dualMode.setMode(initialMode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Mode switch handler ---
  const handleModeSwitch = (targetMode: EditorMode) => {
    setSwitchError(null);
    const result = dualMode.setMode(targetMode);
    if (!result.success) {
      setSwitchError(result.error ?? 'Cannot switch mode');
    }
  };

  // --- Save handler ---
  const handleSave = () => {
    let configToSave: PipelineConfig | null = null;

    if (dualMode.mode === 'visual') {
      configToSave = dualMode.config;
    } else {
      // Text mode: use parsed config
      if (dualMode.isValid) {
        configToSave =
          dualMode.mode === 'yaml'
            ? fromYaml(dualMode.text)
            : fromJson(dualMode.text);
      }
    }

    if (configToSave) {
      onSave(configToSave);
      dualMode.markSaved();
    }
  };

  // --- Determine if save is possible ---
  const canSave =
    dualMode.mode === 'visual'
      ? dualMode.config.id.trim() !== '' && dualMode.config.name.trim() !== ''
      : dualMode.isValid;

  // --- Handle save from text editor (PipelineTextEditor has its own save) ---
  const handleTextSave = (config: PipelineConfig) => {
    onSave(config);
    dualMode.markSaved();
  };

  // --- Handle save from visual editor ---
  const handleVisualSave = (config: PipelineConfig) => {
    onSave(config);
    dualMode.markSaved();
  };

  // --- Dismiss switch error ---
  useEffect(() => {
    if (switchError) {
      const timer = setTimeout(() => setSwitchError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [switchError]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* === Unified Top Bar === */}
      <div className="bg-surface-container-low border-b border-outline-variant/10 px-4 py-3 flex items-center gap-4 shrink-0">
        {/* Title */}
        <div className="flex items-center gap-2">
          <Activity size={16} className="text-primary" />
          <span className="font-headline text-xs font-bold uppercase tracking-widest text-on-surface-variant">
            {isNew ? 'New Pipeline' : 'Edit Pipeline'}
          </span>
        </div>

        {/* Mode Switcher */}
        <div className="flex items-center gap-1 bg-surface-container-highest rounded-sm p-0.5">
          <ModeButton
            mode="visual"
            currentMode={dualMode.mode}
            onClick={() => handleModeSwitch('visual')}
            icon={<Eye size={11} />}
            label={t('pipeline.visual')}
          />
          <ModeButton
            mode="yaml"
            currentMode={dualMode.mode}
            onClick={() => handleModeSwitch('yaml')}
            icon={<FileText size={11} />}
            label="YAML"
          />
          <ModeButton
            mode="json"
            currentMode={dualMode.mode}
            onClick={() => handleModeSwitch('json')}
            icon={<FileJson size={11} />}
            label="JSON"
          />
        </div>

        {/* Mode switch error */}
        {switchError && (
          <div className="flex items-center gap-1.5 px-2 py-1 bg-error/10 border border-error/20 rounded-sm animate-pulse">
            <AlertCircle size={12} className="text-error" />
            <span className="text-[10px] text-error">{switchError}</span>
            <button
              onClick={() => setSwitchError(null)}
              className="text-error/60 hover:text-error ml-1"
            >
              <X size={10} />
            </button>
          </div>
        )}

        <div className="flex-1" />

        {/* Dirty indicator */}
        {dualMode.isDirty && (
          <span className="flex items-center gap-1 text-[10px] text-primary font-bold">
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            Modified
          </span>
        )}
        {!dualMode.isDirty && (
          <span className="flex items-center gap-1 text-[10px] text-tertiary">
            <CheckCircle2 size={10} />
            Saved
          </span>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={onCancel}
            className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant hover:bg-surface-container-high rounded-sm transition-colors"
          >
            <X size={12} />
            Cancel
          </button>
          {!isNew && onDelete && (
            <button
              onClick={() => {
                if (
                  confirm(
                    'Are you sure you want to delete this pipeline?',
                  )
                ) {
                  onDelete(initialConfig!.id);
                }
              }}
              className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-error/60 hover:text-error hover:bg-error/10 rounded-sm transition-colors"
            >
              <Trash2 size={12} />
              Delete
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={!canSave}
            className={cn(
              'flex items-center gap-1 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-sm transition-all',
              canSave
                ? 'bg-primary text-on-primary hover:brightness-110'
                : 'bg-surface-container-highest text-outline cursor-not-allowed',
            )}
          >
            <Save size={12} />
            Save Pipeline
          </button>
        </div>
      </div>

      {/* === Editor Content === */}
      <div className="flex-1 overflow-hidden">
        {dualMode.mode === 'visual' && (
          <PipelineVisualEditor
            initialConfig={initialConfig}
            runtimes={runtimes}
            onSave={handleVisualSave}
            onDelete={undefined} // Delete handled by container top bar
            onCancel={onCancel}
            // Pass current config state so the visual editor stays in sync
            key={JSON.stringify(dualMode.config)}
          />
        )}

        {(dualMode.mode === 'yaml' || dualMode.mode === 'json') && (
          <PipelineTextEditor
            initialConfig={initialConfig}
            onSave={handleTextSave}
            onDelete={undefined} // Delete handled by container top bar
            onCancel={onCancel}
            // Override external format/text state
            externalFormat={dualMode.mode === 'yaml' ? 'yaml' : 'json'}
            externalText={dualMode.text}
            onExternalTextChange={dualMode.setText}
            hideTopBar={true}
          />
        )}
      </div>
    </div>
  );
};
