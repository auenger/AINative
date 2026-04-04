import { useState, useCallback, useMemo, useRef } from 'react';
import type { PipelineConfig } from '../types';

// ---------------------------------------------------------------------------
// Re-exported serialization helpers (originally in PipelineTextEditor)
// ---------------------------------------------------------------------------

/** Quote a YAML string value if it contains special characters. */
function quoteYaml(value: string): string {
  if (!value) return "''";
  if (
    /[:{}\[\],&*?|<>%@!`'"\\\n\r]/.test(value) ||
    value === 'true' ||
    value === 'false' ||
    value === 'null' ||
    /^\d+$/.test(value) ||
    value.startsWith(' ')
  ) {
    return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;
  }
  return value;
}

/** Convert a PipelineConfig to a YAML string. */
export function toYaml(config: PipelineConfig): string {
  const lines: string[] = [];

  lines.push(`id: ${config.id}`);
  lines.push(`name: ${quoteYaml(config.name)}`);

  if (config.description) {
    lines.push(`description: ${quoteYaml(config.description)}`);
  }

  if (config.default_max_retries !== undefined) {
    lines.push(`default_max_retries: ${config.default_max_retries}`);
  }

  if (config.variables && Object.keys(config.variables).length > 0) {
    lines.push('variables:');
    for (const [key, value] of Object.entries(config.variables)) {
      lines.push(`  ${key}: ${quoteYaml(value)}`);
    }
  }

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

/** Parse a YAML scalar value. */
function parseYamlValue(text: string): unknown {
  const commentIdx = text.indexOf(' #');
  if (commentIdx >= 0) {
    text = text.slice(0, commentIdx).trim();
  }

  if (
    (text.startsWith('"') && text.endsWith('"')) ||
    (text.startsWith("'") && text.endsWith("'"))
  ) {
    const inner = text.slice(1, -1);
    if (text.startsWith('"')) {
      return inner
        .replace(/\\n/g, '\n')
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '\\');
    }
    return inner;
  }

  if (text === 'true') return true;
  if (text === 'false') return false;
  if (text === 'null' || text === '~') return null;
  if (/^-?\d+$/.test(text)) return parseInt(text, 10);
  if (/^-?\d+\.\d+$/.test(text)) return parseFloat(text);

  return text;
}

/** Parse a "key: value" line. */
function parseKeyValue(
  text: string,
): { key: string; value: unknown } | null {
  const colonIndex = text.indexOf(':');
  if (colonIndex < 0) return null;

  const key = text.slice(0, colonIndex).trim();
  const valueStr = text.slice(colonIndex + 1).trim();

  if (!valueStr) return { key, value: '' };

  const value = parseYamlValue(valueStr);
  return { key, value };
}

/**
 * Parse a YAML string into a PipelineConfig object.
 * Simplified parser for PipelineConfig structure.
 */
export function fromYaml(text: string): PipelineConfig | null {
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

      if (!trimmed || trimmed.startsWith('#')) continue;

      const indent = line.length - trimmed.length;

      if (indent === 0) {
        currentStage = null;
        currentMapping = null;
        inVariables = false;
      }

      if (trimmed.startsWith('- ') && indent >= 2) {
        currentStage = {};
        currentMapping = null;
        stages.push(currentStage);
        const rest = trimmed.slice(2);
        const kv = parseKeyValue(rest);
        if (kv && currentStage) {
          currentStage[kv.key] = kv.value;
        }
        continue;
      }

      const kv = parseKeyValue(trimmed);
      if (!kv) continue;

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
        (result.variables as Record<string, string>)[kv.key] =
          kv.value as string;
        continue;
      }

      if (kv.key === 'stages' && indent === 0) {
        continue;
      }

      if (kv.key === 'input_mapping' && currentStage && indent === 4) {
        currentMapping = {};
        currentStage.input_mapping = currentMapping;
        continue;
      }

      if (currentMapping && indent === 6) {
        currentMapping[kv.key] = kv.value as string;
        continue;
      }

      if (currentStage && indent === 4) {
        currentStage[kv.key] = kv.value;
        continue;
      }

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

/** Convert PipelineConfig to JSON string. */
export function toJson(config: PipelineConfig): string {
  return JSON.stringify(config, null, 2);
}

/** Parse JSON string to PipelineConfig. */
export function fromJson(text: string): PipelineConfig | null {
  try {
    return JSON.parse(text) as PipelineConfig;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export interface ValidationError {
  line?: number;
  message: string;
}

export function validatePipelineConfig(config: unknown): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!config || typeof config !== 'object') {
    errors.push({ message: 'Invalid config: expected an object' });
    return errors;
  }

  const c = config as Record<string, unknown>;

  if (!c.id || typeof c.id !== 'string' || !(c.id as string).trim()) {
    errors.push({
      message: 'Missing required field: id (non-empty string)',
    });
  } else if (!/^[a-z][a-z0-9-]*$/.test(c.id as string)) {
    errors.push({
      message:
        'Field "id" must be kebab-case (lowercase letters, numbers, hyphens)',
    });
  }

  if (!c.name || typeof c.name !== 'string' || !(c.name as string).trim()) {
    errors.push({
      message: 'Missing required field: name (non-empty string)',
    });
  }

  if (
    !c.stages ||
    !Array.isArray(c.stages) ||
    (c.stages as unknown[]).length === 0
  ) {
    errors.push({
      message: 'Missing required field: stages (non-empty array)',
    });
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
        errors.push({
          message: `${prefix}: missing required field "runtime_id"`,
        });
      }
      if (
        !stage.prompt_template ||
        typeof stage.prompt_template !== 'string'
      ) {
        errors.push({
          message: `${prefix}: missing required field "prompt_template"`,
        });
      }
    });
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Editor Mode type
// ---------------------------------------------------------------------------

export type EditorMode = 'visual' | 'yaml' | 'json';

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface UsePipelineDualModeOptions {
  /** Initial config to edit (null = creating new). */
  initialConfig: PipelineConfig | null;
}

export interface UsePipelineDualModeReturn {
  /** Current editor mode. */
  mode: EditorMode;
  /** Set editor mode. Validates text before switching from text modes. */
  setMode: (mode: EditorMode) => ModeSwitchResult;
  /** Current PipelineConfig (always kept in sync). */
  config: PipelineConfig;
  /** Update the config from visual editor. */
  updateConfig: (config: PipelineConfig) => void;
  /** Current text content (for text modes). */
  text: string;
  /** Update text content (for text modes). */
  setText: (text: string) => void;
  /** Whether there are unsaved changes. */
  isDirty: boolean;
  /** Mark current state as saved. */
  markSaved: () => void;
  /** Validation errors (for text mode). */
  errors: ValidationError[];
  /** Whether the current text is valid. */
  isValid: boolean;
}

export interface ModeSwitchResult {
  /** Whether the switch succeeded. */
  success: boolean;
  /** Error message if the switch was blocked. */
  error?: string;
}

export function usePipelineDualMode({
  initialConfig,
}: UsePipelineDualModeOptions): UsePipelineDualModeReturn {
  // Canonical config state (source of truth)
  const defaultConfig: PipelineConfig = initialConfig ?? {
    id: '',
    name: '',
    stages: [],
  };

  const [config, setConfig] = useState<PipelineConfig>(defaultConfig);
  const [mode, setModeState] = useState<EditorMode>('visual');
  const [text, setTextState] = useState<string>(() => {
    if (!initialConfig) return toYaml({ id: '', name: '', stages: [] });
    return toYaml(initialConfig);
  });

  // Track the text that was last saved / synced
  const [lastSavedText, setLastSavedText] = useState<string>(text);
  const [lastSavedConfig, setLastSavedConfig] = useState<PipelineConfig>(defaultConfig);

  // Parse + validate the current text (memoized)
  const parsed = useMemo(() => {
    let parsedConfig: PipelineConfig | null = null;
    const parseErrors: ValidationError[] = [];

    if (mode === 'yaml') {
      parsedConfig = fromYaml(text);
    } else if (mode === 'json') {
      parsedConfig = fromJson(text);
    }

    if (!parsedConfig && mode !== 'visual') {
      parseErrors.push({
        message:
          mode === 'yaml' ? 'Invalid YAML syntax' : 'Invalid JSON syntax',
      });
      return { config: null, errors: parseErrors };
    }

    if (parsedConfig) {
      const validationErrors = validatePipelineConfig(parsedConfig);
      return { config: parsedConfig, errors: validationErrors };
    }

    return { config: null, errors: [] };
  }, [text, mode]);

  const errors = parsed.errors;
  const isValid = parsed.config !== null && parsed.errors.length === 0;

  // Dirty detection
  const isDirty =
    mode === 'visual'
      ? JSON.stringify(config) !== JSON.stringify(lastSavedConfig)
      : text !== lastSavedText;

  const markSaved = useCallback(() => {
    setLastSavedText(text);
    setLastSavedConfig(config);
  }, [text, config]);

  // --- Mode switching ---
  const setMode = useCallback(
    (newMode: EditorMode): ModeSwitchResult => {
      if (newMode === mode) return { success: true };

      // Switching FROM a text mode: validate before allowing switch
      if ((mode === 'yaml' || mode === 'json') && !isValid) {
        return {
          success: false,
          error:
            'Cannot switch: fix syntax errors first, or discard your changes.',
        };
      }

      // Sync state when switching modes
      if (mode === 'visual') {
        // Visual -> Text: serialize current config
        const newText =
          newMode === 'json' ? toJson(config) : toYaml(config);
        setTextState(newText);
        setLastSavedText(newText);
      } else if (
        (mode === 'yaml' || mode === 'json') &&
        newMode === 'visual'
      ) {
        // Text -> Visual: parse text and update config
        if (parsed.config) {
          setConfig(parsed.config);
          setLastSavedConfig(parsed.config);
        }
      } else {
        // Text -> Text (yaml <-> json): convert through config
        const sourceConfig =
          mode === 'yaml' ? fromYaml(text) : fromJson(text);
        if (sourceConfig) {
          const newText =
            newMode === 'json' ? toJson(sourceConfig) : toYaml(sourceConfig);
          setTextState(newText);
          setLastSavedText(newText);
        }
      }

      setModeState(newMode);
      return { success: true };
    },
    [mode, config, text, isValid, parsed.config],
  );

  // --- Config update (from visual editor) ---
  const updateConfig = useCallback((newConfig: PipelineConfig) => {
    setConfig(newConfig);
  }, []);

  // --- Text update (from text editor) ---
  const setText = useCallback((newText: string) => {
    setTextState(newText);
  }, []);

  return {
    mode,
    setMode,
    config,
    updateConfig,
    text,
    setText,
    isDirty,
    markSaved,
    errors,
    isValid,
  };
}
