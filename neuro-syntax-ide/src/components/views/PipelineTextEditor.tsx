import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  Save,
  X,
  FileText,
  FileJson,
  AlertCircle,
  CheckCircle2,
  ArrowLeftRight,
  Activity,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import type {
  PipelineConfig,
  PipelineStageConfig,
} from '../../types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TextFormat = 'yaml' | 'json';

export interface PipelineTextEditorProps {
  /** Existing pipeline config to edit (null = create new). */
  initialConfig: PipelineConfig | null;
  /** Save handler. */
  onSave: (config: PipelineConfig) => void;
  /** Delete handler. */
  onDelete?: (id: string) => void;
  /** Cancel handler. */
  onCancel: () => void;
}

interface ValidationError {
  line?: number;
  message: string;
}

// ---------------------------------------------------------------------------
// Simple YAML Serializer / Deserializer
// ---------------------------------------------------------------------------

/**
 * A lightweight YAML serializer/deserializer for PipelineConfig.
 * Handles the flat structure of PipelineConfig without needing js-yaml.
 * Supports: strings, numbers, arrays of objects, and simple key-value maps.
 */

/** Convert a PipelineConfig to a YAML string. */
function toYaml(config: PipelineConfig): string {
  const lines: string[] = [];

  lines.push(`id: ${config.id}`);
  lines.push(`name: ${quoteYaml(config.name)}`);

  if (config.description) {
    lines.push(`description: ${quoteYaml(config.description)}`);
  }

  if (config.default_max_retries !== undefined) {
    lines.push(`default_max_retries: ${config.default_max_retries}`);
  }

  // Global variables
  if (config.variables && Object.keys(config.variables).length > 0) {
    lines.push('variables:');
    for (const [key, value] of Object.entries(config.variables)) {
      lines.push(`  ${key}: ${quoteYaml(value)}`);
    }
  }

  // Stages
  lines.push(`stages:`);
  for (const stage of config.stages) {
    lines.push(`  - id: ${stage.id}`);
    lines.push(`    name: ${quoteYaml(stage.name)}`);
    lines.push(`    runtime_id: ${quoteYaml(stage.runtime_id)}`);
    lines.push(`    prompt_template: ${quoteYaml(stage.prompt_template)}`);

    if (stage.input_mapping && Object.keys(stage.input_mapping).length > 0) {
      lines.push(`    input_mapping:`);
      for (const [key, value] of Object.entries(stage.input_mapping)) {
        lines.push(`      ${key}: ${quoteYaml(value)}`);
      }
    }

    if (stage.max_retries !== undefined) {
      lines.push(`    max_retries: ${stage.max_retries}`);
    }

    if (stage.timeout_seconds !== undefined) {
      lines.push(`    timeout_seconds: ${stage.timeout_seconds}`);
    }
  }

  return lines.join('\n');
}

/** Quote a YAML string value if it contains special characters. */
function quoteYaml(value: string): string {
  if (!value) return "''";
  // Need quoting if it contains special YAML chars or is multi-line
  if (/[:{}\[\],&*?|<>%@!`'"\\\n\r]/.test(value) ||
      value === 'true' || value === 'false' || value === 'null' ||
      /^\d+$/.test(value) || value.startsWith(' ')) {
    // Use double quotes and escape internal double quotes
    return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;
  }
  return value;
}

/**
 * Parse a YAML string into a PipelineConfig object.
 * This is a simplified parser that handles the PipelineConfig structure.
 */
function fromYaml(text: string): PipelineConfig | null {
  try {
    const lines = text.split('\n');
    const result: Record<string, unknown> = {};
    let currentStage: Record<string, unknown> | null = null;
    let currentMapping: Record<string, string> | null = null;
    let inVariables = false;
    const stages: Record<string, unknown>[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trimStart();

      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith('#')) continue;

      const indent = line.length - trimmed.length;

      // Reset context based on indentation
      if (indent === 0) {
        currentStage = null;
        currentMapping = null;
        inVariables = false;
      }

      // Parse stages list item: "  - key: value"
      if (trimmed.startsWith('- ') && indent >= 2) {
        currentStage = {};
        currentMapping = null;
        stages.push(currentStage);
        // Parse the rest of the line as a key-value pair after the "- "
        const rest = trimmed.slice(2);
        const kv = parseKeyValue(rest);
        if (kv && currentStage) {
          currentStage[kv.key] = kv.value;
        }
        continue;
      }

      // Parse key: value
      const kv = parseKeyValue(trimmed);
      if (!kv) continue;

      // Variables block
      if (kv.key === 'variables' && indent === 0) {
        if (typeof kv.value === 'object' && kv.value !== null) {
          result.variables = kv.value;
        } else {
          inVariables = true;
          result.variables = {};
        }
        continue;
      }

      if (inVariables && indent === 2) {
        (result.variables as Record<string, string>)[kv.key] = kv.value as string;
        continue;
      }

      // Stages block
      if (kv.key === 'stages' && indent === 0) {
        continue; // stages array is populated by list items
      }

      // Stage-level input_mapping
      if (kv.key === 'input_mapping' && currentStage && indent === 4) {
        currentMapping = {};
        currentStage.input_mapping = currentMapping;
        continue;
      }

      if (currentMapping && indent === 6) {
        currentMapping[kv.key] = kv.value as string;
        continue;
      }

      // Stage-level properties (indent 4)
      if (currentStage && indent === 4) {
        currentStage[kv.key] = kv.value;
        continue;
      }

      // Top-level properties (indent 0)
      if (indent === 0) {
        result[kv.key] = kv.value;
      }
    }

    if (stages.length > 0) {
      result.stages = stages;
    }

    return result as unknown as PipelineConfig;
  } catch {
    return null;
  }
}

/** Parse a "key: value" line. */
function parseKeyValue(text: string): { key: string; value: unknown } | null {
  const colonIndex = text.indexOf(':');
  if (colonIndex < 0) return null;

  const key = text.slice(0, colonIndex).trim();
  let valueStr = text.slice(colonIndex + 1).trim();

  if (!valueStr) return { key, value: '' };

  const value = parseYamlValue(valueStr);
  return { key, value };
}

/** Parse a YAML scalar value. */
function parseYamlValue(text: string): unknown {
  // Remove comments at end
  const commentIdx = text.indexOf(' #');
  if (commentIdx >= 0) {
    text = text.slice(0, commentIdx).trim();
  }

  // Quoted strings
  if ((text.startsWith('"') && text.endsWith('"')) ||
      (text.startsWith("'") && text.endsWith("'"))) {
    const inner = text.slice(1, -1);
    if (text.startsWith('"')) {
      return inner.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    }
    return inner;
  }

  // Booleans
  if (text === 'true') return true;
  if (text === 'false') return false;

  // Null
  if (text === 'null' || text === '~') return null;

  // Numbers
  if (/^-?\d+$/.test(text)) return parseInt(text, 10);
  if (/^-?\d+\.\d+$/.test(text)) return parseFloat(text);

  // Plain string
  return text;
}

// ---------------------------------------------------------------------------
// JSON Helpers
// ---------------------------------------------------------------------------

function toJson(config: PipelineConfig): string {
  return JSON.stringify(config, null, 2);
}

function fromJson(text: string): PipelineConfig | null {
  try {
    return JSON.parse(text) as PipelineConfig;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validatePipelineConfig(config: unknown): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!config || typeof config !== 'object') {
    errors.push({ message: 'Invalid config: expected an object' });
    return errors;
  }

  const c = config as Record<string, unknown>;

  // Required top-level fields
  if (!c.id || typeof c.id !== 'string' || !(c.id as string).trim()) {
    errors.push({ message: 'Missing required field: id (non-empty string)' });
  } else if (!/^[a-z][a-z0-9-]*$/.test(c.id as string)) {
    errors.push({ message: 'Field "id" must be kebab-case (lowercase letters, numbers, hyphens)' });
  }

  if (!c.name || typeof c.name !== 'string' || !(c.name as string).trim()) {
    errors.push({ message: 'Missing required field: name (non-empty string)' });
  }

  if (!c.stages || !Array.isArray(c.stages) || (c.stages as unknown[]).length === 0) {
    errors.push({ message: 'Missing required field: stages (non-empty array)' });
  } else {
    (c.stages as Record<string, unknown>[]).forEach((stage, i) => {
      const prefix = `stages[${i}]`;
      if (!stage.id || typeof stage.id !== 'string') {
        errors.push({ message: `${prefix}: missing required field "id"` });
      }
      if (!stage.name || typeof stage.name !== 'string') {
        errors.push({ message: `${prefix}: missing required field "name"` });
      }
      if (!stage.runtime_id || typeof stage.runtime_id !== 'string') {
        errors.push({ message: `${prefix}: missing required field "runtime_id"` });
      }
      if (!stage.prompt_template || typeof stage.prompt_template !== 'string') {
        errors.push({ message: `${prefix}: missing required field "prompt_template"` });
      }
    });
  }

  return errors;
}

// ---------------------------------------------------------------------------
// PipelineTextEditor Component
// ---------------------------------------------------------------------------

export const PipelineTextEditor: React.FC<PipelineTextEditorProps> = ({
  initialConfig,
  onSave,
  onDelete,
  onCancel,
}) => {
  const isNew = !initialConfig;

  // Format state
  const [format, setFormat] = useState<TextFormat>('yaml');

  // Build initial text content
  const initialText = useMemo(() => {
    if (!initialConfig) {
      const defaultConfig: PipelineConfig = {
        id: '',
        name: '',
        stages: [],
      };
      return format === 'yaml' ? toYaml(defaultConfig) : toJson(defaultConfig);
    }
    return format === 'yaml' ? toYaml(initialConfig) : toJson(initialConfig);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialConfig]);

  const [text, setText] = useState(() => {
    if (!initialConfig) {
      const defaultConfig: PipelineConfig = {
        id: '',
        name: '',
        stages: [],
      };
      return toYaml(defaultConfig);
    }
    return toYaml(initialConfig);
  });

  const [parseErrors, setParseErrors] = useState<ValidationError[]>([]);
  const [lastSavedText, setLastSavedText] = useState(text);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Track if text has changed since last save
  const isDirty = text !== lastSavedText;

  // Parse and validate the current text
  const parsedConfig = useMemo<{ config: PipelineConfig | null; errors: ValidationError[] }>(() => {
    let config: PipelineConfig | null = null;
    const parseErrorsLocal: ValidationError[] = [];

    if (format === 'yaml') {
      config = fromYaml(text);
    } else {
      config = fromJson(text);
    }

    if (!config) {
      parseErrorsLocal.push({
        message: format === 'yaml'
          ? 'Invalid YAML syntax'
          : 'Invalid JSON syntax',
      });
      return { config: null, errors: parseErrorsLocal };
    }

    const validationErrors = validatePipelineConfig(config);
    return { config, errors: validationErrors };
  }, [text, format]);

  // Update error state
  useEffect(() => {
    setParseErrors(parsedConfig.errors);
  }, [parsedConfig.errors]);

  const isValid = parsedConfig.config !== null && parsedConfig.errors.length === 0;

  // Format toggle handler
  const handleFormatToggle = useCallback(() => {
    const newFormat: TextFormat = format === 'yaml' ? 'json' : 'yaml';

    // Try to parse current text and convert
    let config: PipelineConfig | null = null;
    if (format === 'yaml') {
      config = fromYaml(text);
    } else {
      config = fromJson(text);
    }

    if (config) {
      const newText = newFormat === 'yaml' ? toYaml(config) : toJson(config);
      setText(newText);
      setLastSavedText(newText);
    }

    setFormat(newFormat);
  }, [format, text]);

  // Save handler
  const handleSave = useCallback(() => {
    if (!parsedConfig.config || !isValid) return;
    onSave(parsedConfig.config);
    setLastSavedText(text);
  }, [parsedConfig.config, isValid, onSave, text]);

  // Keyboard shortcut: Ctrl/Cmd + S to save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (isValid) {
          handleSave();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isValid, handleSave]);

  // Line count for display
  const lineCount = text.split('\n').length;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* === Top bar === */}
      <div className="bg-surface-container-low border-b border-outline-variant/10 px-4 py-3 flex items-center gap-4 shrink-0">
        <div className="flex items-center gap-2">
          <Activity size={16} className="text-primary" />
          <span className="font-headline text-xs font-bold uppercase tracking-widest text-on-surface-variant">
            {isNew ? 'New Pipeline (Text)' : 'Edit Pipeline (Text)'}
          </span>
        </div>

        {/* Format toggle */}
        <div className="flex items-center gap-1 bg-surface-container-highest rounded-sm p-0.5">
          <button
            onClick={() => {
              if (format !== 'yaml') handleFormatToggle();
            }}
            className={cn(
              'flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-sm transition-all',
              format === 'yaml'
                ? 'bg-primary text-on-primary'
                : 'text-on-surface-variant hover:text-on-surface',
            )}
          >
            <FileText size={11} />
            YAML
          </button>
          <button
            onClick={() => {
              if (format !== 'json') handleFormatToggle();
            }}
            className={cn(
              'flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-sm transition-all',
              format === 'json'
                ? 'bg-primary text-on-primary'
                : 'text-on-surface-variant hover:text-on-surface',
            )}
          >
            <FileJson size={11} />
            JSON
          </button>
        </div>

        {/* Convert button */}
        <button
          onClick={handleFormatToggle}
          className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant hover:bg-surface-container-high rounded-sm transition-colors"
          title={`Convert to ${format === 'yaml' ? 'JSON' : 'YAML'}`}
        >
          <ArrowLeftRight size={12} />
          Convert
        </button>

        <div className="flex-1" />

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={onCancel}
            className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant hover:bg-surface-container-high rounded-sm transition-colors"
          >
            <X size={12} />
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!isValid}
            className={cn(
              'flex items-center gap-1 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-sm transition-all',
              isValid
                ? 'bg-primary text-on-primary hover:brightness-110'
                : 'bg-surface-container-highest text-outline cursor-not-allowed',
            )}
          >
            <Save size={12} />
            Save Pipeline
          </button>
        </div>
      </div>

      {/* === Editor area === */}
      <div className="flex-1 flex overflow-hidden">
        {/* Text editor */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 relative">
            {/* Line numbers */}
            <div className="absolute left-0 top-0 bottom-0 w-10 bg-surface-container-lowest border-r border-outline-variant/10 overflow-hidden select-none z-10">
              <div className="pt-3 pb-3">
                {Array.from({ length: lineCount }, (_, i) => (
                  <div
                    key={i}
                    className="text-[10px] font-mono text-outline/60 text-right pr-2 leading-[20px] h-[20px]"
                  >
                    {i + 1}
                  </div>
                ))}
              </div>
            </div>

            {/* Textarea */}
            <textarea
              ref={textareaRef}
              value={text}
              onChange={e => setText(e.target.value)}
              spellCheck={false}
              className={cn(
                'w-full h-full pl-12 pr-4 pt-3 pb-3 bg-surface-container-lowest',
                'font-mono text-xs leading-[20px] text-on-surface',
                'border-none outline-none resize-none',
                'focus:ring-0',
                parseErrors.length > 0 && 'caret-red-400',
              )}
              style={{ tabSize: 2 }}
            />
          </div>

          {/* Status bar */}
          <div className="px-3 py-1.5 bg-surface-container-low border-t border-outline-variant/10 flex items-center justify-between text-[9px] text-outline font-mono shrink-0">
            <div className="flex items-center gap-4">
              <span className="uppercase">{format}</span>
              <span>{lineCount} lines</span>
              <span>{text.length} chars</span>
            </div>
            <div className="flex items-center gap-4">
              {isDirty && (
                <span className="text-primary">Modified</span>
              )}
              {!isDirty && (
                <span className="flex items-center gap-1 text-tertiary">
                  <CheckCircle2 size={10} />
                  Saved
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Validation sidebar */}
        <aside className="w-64 bg-surface-container-low border-l border-outline-variant/10 flex flex-col shrink-0">
          <div className="p-3 border-b border-outline-variant/10">
            <h3 className="font-headline text-xs font-bold uppercase tracking-widest text-on-surface-variant">
              Validation
            </h3>
          </div>

          <div className="flex-1 overflow-y-auto p-3 scroll-hide">
            {parseErrors.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <CheckCircle2 size={24} className="text-tertiary mb-2" />
                <p className="text-xs text-tertiary font-bold uppercase tracking-wider">
                  Valid
                </p>
                <p className="text-[10px] text-on-surface-variant mt-1">
                  Pipeline config is syntactically correct
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {parseErrors.map((err, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 p-2 bg-error/5 border border-error/20 rounded-sm"
                  >
                    <AlertCircle size={12} className="text-error flex-shrink-0 mt-0.5" />
                    <span className="text-[10px] text-error leading-tight">
                      {err.message}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Parsed preview */}
          {parsedConfig.config && (
            <div className="border-t border-outline-variant/10 p-3">
              <h4 className="text-[9px] font-bold text-outline uppercase tracking-tighter mb-2">
                Parsed Preview
              </h4>
              <div className="space-y-1 text-[10px] text-on-surface-variant">
                <div className="flex justify-between">
                  <span>ID:</span>
                  <span className="font-mono">{parsedConfig.config.id || '(empty)'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Name:</span>
                  <span className="font-mono truncate max-w-[120px]">{parsedConfig.config.name || '(empty)'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Stages:</span>
                  <span className="font-mono">{parsedConfig.config.stages?.length ?? 0}</span>
                </div>
                {parsedConfig.config.variables && (
                  <div className="flex justify-between">
                    <span>Variables:</span>
                    <span className="font-mono">{Object.keys(parsedConfig.config.variables).length}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Delete pipeline button */}
          {!isNew && onDelete && (
            <div className="p-3 border-t border-outline-variant/10 bg-surface-container-lowest">
              <button
                onClick={() => {
                  if (confirm('Are you sure you want to delete this pipeline?')) {
                    onDelete(initialConfig!.id);
                  }
                }}
                className="w-full flex items-center justify-center gap-1.5 py-2 text-[10px] font-bold uppercase tracking-wider text-error/60 hover:text-error hover:bg-error/10 rounded-sm transition-colors"
              >
                Delete Pipeline
              </button>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};
