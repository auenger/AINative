import { useState, useCallback, useRef } from 'react';
import {
  PipelineConfig,
  PipelineExecution,
  PipelineStageExecution,
  PipelineStatusType,
  PipelineStageOutputEvent,
} from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

/** Generate a unique id for executions. */
function uid(): string {
  return `exec-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Create a blank stage execution record. */
function blankStageExecution(stageId: string): PipelineStageExecution {
  return {
    stage_id: stageId,
    status: 'pending',
    input: '',
    output: '',
    error: null,
    attempts: 0,
    started_at: null,
    finished_at: null,
  };
}

// ---------------------------------------------------------------------------
// Dev-mode simulated agent runtime (for use outside Tauri)
// ---------------------------------------------------------------------------

/** Simulate an agent call with a delay and echo-based response. */
async function simulateAgentRun(
  stageName: string,
  input: string,
  _runtimeId: string,
  onChunk: (text: string, isDone: boolean) => void,
): Promise<string> {
  // Simulate streaming with progressive text
  const lines = [
    `[Stage: ${stageName}]\n`,
    `Processing input (${input.length} chars)...\n`,
    `Analysis complete.\n`,
    `Result: Processed output from "${stageName}" for input: "${input.slice(0, 60)}${input.length > 60 ? '...' : ''}"\n`,
  ];

  let full = '';
  for (const line of lines) {
    await new Promise(r => setTimeout(r, 400 + Math.random() * 400));
    full += line;
    onChunk(line, false);
  }

  await new Promise(r => setTimeout(r, 300));
  onChunk('', true);
  return full;
}

// ---------------------------------------------------------------------------
// Hook return type
// ---------------------------------------------------------------------------

export interface PipelineEngineState {
  /** All known pipeline configs (keyed by id). */
  pipelines: Record<string, PipelineConfig>;
  /** Currently running executions (keyed by execution id). */
  executions: Record<string, PipelineExecution>;
  /** List of pipeline config ids. */
  pipelineIds: string[];
  /** Last error. */
  error: string | null;
  /** Whether a config-level operation is in progress. */
  loading: boolean;

  // Config operations
  /** Load all pipeline configs from storage. */
  loadPipelines: () => Promise<void>;
  /** Create / save a pipeline config. */
  savePipeline: (config: PipelineConfig) => Promise<void>;
  /** Delete a pipeline config by id. */
  deletePipeline: (id: string) => Promise<void>;

  // Execution operations
  /** Start executing a pipeline with the given initial input. */
  executePipeline: (pipelineId: string, input: string) => Promise<string>;
  /** Pause a running pipeline execution. */
  pausePipeline: (executionId: string) => void;
  /** Resume a paused pipeline execution. */
  resumePipeline: (executionId: string) => Promise<void>;
  /** Retry a failed stage (continue pipeline from that stage). */
  retryStage: (executionId: string) => Promise<void>;
  /** Get execution status. */
  getExecution: (executionId: string) => PipelineExecution | undefined;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function usePipelineEngine(): PipelineEngineState {
  const [pipelines, setPipelines] = useState<Record<string, PipelineConfig>>({});
  const [executions, setExecutions] = useState<Record<string, PipelineExecution>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Track active execution abort controllers
  const abortRef = useRef<Map<string, { aborted: boolean }>>(new Map());

  const pipelineIds = Object.keys(pipelines);

  // -------------------------------------------------------------------------
  // Config operations
  // -------------------------------------------------------------------------

  const loadPipelines = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      if (isTauri) {
        const { invoke } = await import('@tauri-apps/api/core');
        const list: PipelineConfig[] = await invoke('list_pipelines');
        const map: Record<string, PipelineConfig> = {};
        for (const p of list) map[p.id] = p;
        setPipelines(map);
      } else {
        // Dev fallback: load from localStorage
        const stored = localStorage.getItem('neuro_pipelines');
        if (stored) {
          const parsed = JSON.parse(stored) as PipelineConfig[];
          const map: Record<string, PipelineConfig> = {};
          for (const p of parsed) map[p.id] = p;
          setPipelines(map);
        }
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const savePipeline = useCallback(async (config: PipelineConfig) => {
    setLoading(true);
    setError(null);

    try {
      if (isTauri) {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('create_pipeline', { config });
      } else {
        // Dev fallback: persist to localStorage
        const stored = localStorage.getItem('neuro_pipelines');
        const existing: PipelineConfig[] = stored ? JSON.parse(stored) : [];
        const idx = existing.findIndex(p => p.id === config.id);
        if (idx >= 0) existing[idx] = config;
        else existing.push(config);
        localStorage.setItem('neuro_pipelines', JSON.stringify(existing));
      }
      setPipelines(prev => ({ ...prev, [config.id]: config }));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const deletePipeline = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);

    try {
      if (isTauri) {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('delete_pipeline', { id });
      } else {
        const stored = localStorage.getItem('neuro_pipelines');
        if (stored) {
          const existing: PipelineConfig[] = JSON.parse(stored);
          const filtered = existing.filter(p => p.id !== id);
          localStorage.setItem('neuro_pipelines', JSON.stringify(filtered));
        }
      }
      setPipelines(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  // -------------------------------------------------------------------------
  // Stage execution helper
  // -------------------------------------------------------------------------

  /** Execute a single stage, handling retries. Returns the output or throws. */
  const runStage = useCallback(async (
    exec: PipelineExecution,
    stageIndex: number,
    config: PipelineConfig,
    abortFlag: { aborted: boolean },
  ): Promise<string> => {
    const stageConf = config.stages[stageIndex];
    const maxRetries = stageConf.max_retries ?? config.default_max_retries ?? 0;
    let lastError: string | null = null;

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      if (abortFlag.aborted) throw new Error('Aborted');

      // Update stage state: running
      setExecutions(prev => {
        const e = prev[exec.id];
        if (!e) return prev;
        const stages = [...e.stages];
        stages[stageIndex] = {
          ...stages[stageIndex],
          status: 'running',
          attempts: attempt,
          started_at: new Date().toISOString(),
          error: null,
        };
        return { ...prev, [exec.id]: { ...e, stages, current_stage_index: stageIndex } };
      });

      try {
        // Build prompt from template
        const prevOutput = stageIndex > 0
          ? exec.stages[stageIndex - 1].output
          : '';
        const currentInput = stageIndex === 0
          ? exec.initial_input
          : prevOutput;

        let prompt = stageConf.prompt_template
          .replace(/\{\{input\}\}/g, exec.initial_input)
          .replace(/\{\{prev_output\}\}/g, prevOutput);

        // Replace input_mapping variables
        if (stageConf.input_mapping) {
          for (const [key, value] of Object.entries(stageConf.input_mapping)) {
            prompt = prompt.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
          }
        }

        // Replace global variables
        if (config.variables) {
          for (const [key, value] of Object.entries(config.variables)) {
            prompt = prompt.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
          }
        }

        // Update stage input
        setExecutions(prev => {
          const e = prev[exec.id];
          if (!e) return prev;
          const stages = [...e.stages];
          stages[stageIndex] = { ...stages[stageIndex], input: prompt };
          return { ...prev, [exec.id]: { ...e, stages } };
        });

        let output: string;

        if (isTauri) {
          // Real Tauri IPC execution
          const { invoke } = await import('@tauri-apps/api/core');
          const { listen } = await import('@tauri-apps/api/event');

          // Emit stage-start event
          await invoke('pipeline_stage_start', {
            executionId: exec.id,
            pipelineId: config.id,
            stageIndex,
            stageId: stageConf.id,
          });

          // Collect streaming output
          let collected = '';
          await new Promise<void>((resolve, reject) => {
            let unlisten: (() => void) | null = null;

            listen<PipelineStageOutputEvent>('pipeline://stage-output', (event) => {
              const payload = event.payload;
              if (payload.execution_id !== exec.id || payload.stage_index !== stageIndex) return;

              if (payload.error) {
                reject(new Error(payload.error));
                unlisten?.();
                return;
              }

              collected += payload.text;

              // Update stage output incrementally
              setExecutions(prev => {
                const e = prev[exec.id];
                if (!e) return prev;
                const stages = [...e.stages];
                stages[stageIndex] = { ...stages[stageIndex], output: collected };
                return { ...prev, [exec.id]: { ...e, stages } };
              });

              if (payload.is_done) {
                unlisten?.();
                resolve();
              }
            }).then(fn => { unlisten = fn; });

            // Start the stage execution via IPC
            invoke('execute_pipeline_stage', {
              executionId: exec.id,
              pipelineId: config.id,
              stageIndex,
              prompt,
              runtimeId: stageConf.runtime_id,
            }).catch(err => {
              unlisten?.();
              reject(err);
            });
          });

          output = collected;
        } else {
          // Dev-mode simulation
          output = await simulateAgentRun(
            stageConf.name,
            prompt,
            stageConf.runtime_id,
            (_text, _isDone) => {
              // Progressive output updates handled inside simulateAgentRun
            },
          );
        }

        // Mark stage completed
        setExecutions(prev => {
          const e = prev[exec.id];
          if (!e) return prev;
          const stages = [...e.stages];
          stages[stageIndex] = {
            ...stages[stageIndex],
            status: 'completed',
            output,
            finished_at: new Date().toISOString(),
          };
          return { ...prev, [exec.id]: { ...e, stages } };
        });

        return output;
      } catch (e: unknown) {
        lastError = e instanceof Error ? e.message : String(e);

        // Mark stage as failed
        setExecutions(prev => {
          const e = prev[exec.id];
          if (!e) return prev;
          const stages = [...e.stages];
          stages[stageIndex] = {
            ...stages[stageIndex],
            status: 'failed',
            error: lastError,
            finished_at: new Date().toISOString(),
          };
          return { ...prev, [exec.id]: { ...e, stages } };
        });

        if (attempt <= maxRetries) {
          // Wait a bit before retry
          await new Promise(r => setTimeout(r, 1000 * attempt));
        }
      }
    }

    throw new Error(lastError ?? 'Stage failed after retries');
  }, []);

  // -------------------------------------------------------------------------
  // Pipeline execution
  // -------------------------------------------------------------------------

  const executePipeline = useCallback(async (
    pipelineId: string,
    input: string,
  ): Promise<string> => {
    const config = pipelines[pipelineId];
    if (!config) {
      setError(`Pipeline "${pipelineId}" not found`);
      throw new Error(`Pipeline "${pipelineId}" not found`);
    }

    const execId = uid();
    const abortFlag = { aborted: false };
    abortRef.current.set(execId, abortFlag);

    const exec: PipelineExecution = {
      id: execId,
      pipeline_id: pipelineId,
      status: 'running',
      current_stage_index: -1,
      stages: config.stages.map(s => blankStageExecution(s.id)),
      initial_input: input,
      started_at: new Date().toISOString(),
      finished_at: null,
      error: null,
    };

    setExecutions(prev => ({ ...prev, [execId]: exec }));

    // Run stages sequentially
    try {
      for (let i = 0; i < config.stages.length; i++) {
        if (abortFlag.aborted) {
          // Pipeline was paused
          setExecutions(prev => {
            const e = prev[execId];
            if (!e) return prev;
            return {
              ...prev,
              [execId]: {
                ...e,
                status: 'paused',
                current_stage_index: i,
                error: 'Paused by user',
              },
            };
          });
          return execId;
        }

        await runStage(exec, i, config, abortFlag);
      }

      // All stages completed
      setExecutions(prev => {
        const e = prev[execId];
        if (!e) return prev;
        return {
          ...prev,
          [execId]: {
            ...e,
            status: 'completed',
            current_stage_index: config.stages.length - 1,
            finished_at: new Date().toISOString(),
          },
        };
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setExecutions(prev => {
        const ex = prev[execId];
        if (!ex) return prev;
        // Only set to failed if not paused
        if (ex.status === 'paused') return prev;
        return {
          ...prev,
          [execId]: {
            ...ex,
            status: 'failed',
            error: msg,
            finished_at: new Date().toISOString(),
          },
        };
      });
    } finally {
      abortRef.current.delete(execId);
    }

    return execId;
  }, [pipelines, runStage]);

  // -------------------------------------------------------------------------
  // Pause / Resume
  // -------------------------------------------------------------------------

  const pausePipeline = useCallback((executionId: string) => {
    const flag = abortRef.current.get(executionId);
    if (flag) flag.aborted = true;
  }, []);

  const resumePipeline = useCallback(async (executionId: string) => {
    const exec = executions[executionId];
    if (!exec || exec.status !== 'paused') return;

    const config = pipelines[exec.pipeline_id];
    if (!config) return;

    const abortFlag = { aborted: false };
    abortRef.current.set(executionId, abortFlag);

    // Set status back to running
    setExecutions(prev => {
      const e = prev[executionId];
      if (!e) return prev;
      return { ...prev, [executionId]: { ...e, status: 'running', error: null } };
    });

    // Find the first non-completed stage
    let startIndex = exec.stages.findIndex(s => s.status !== 'completed');
    if (startIndex < 0) startIndex = config.stages.length - 1;

    try {
      for (let i = startIndex; i < config.stages.length; i++) {
        if (abortFlag.aborted) {
          setExecutions(prev => {
            const e = prev[executionId];
            if (!e) return prev;
            return {
              ...prev,
              [executionId]: {
                ...e,
                status: 'paused',
                current_stage_index: i,
                error: 'Paused by user',
              },
            };
          });
          return;
        }

        await runStage(exec, i, config, abortFlag);
      }

      setExecutions(prev => {
        const e = prev[executionId];
        if (!e) return prev;
        return {
          ...prev,
          [executionId]: {
            ...e,
            status: 'completed',
            current_stage_index: config.stages.length - 1,
            finished_at: new Date().toISOString(),
          },
        };
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setExecutions(prev => {
        const ex = prev[executionId];
        if (!ex) return prev;
        if (ex.status === 'paused') return prev;
        return {
          ...prev,
          [executionId]: {
            ...ex,
            status: 'failed',
            error: msg,
            finished_at: new Date().toISOString(),
          },
        };
      });
    } finally {
      abortRef.current.delete(executionId);
    }
  }, [executions, pipelines, runStage]);

  // -------------------------------------------------------------------------
  // Retry failed stage
  // -------------------------------------------------------------------------

  const retryStage = useCallback(async (executionId: string) => {
    const exec = executions[executionId];
    if (!exec || (exec.status !== 'failed' && exec.status !== 'paused')) return;

    const config = pipelines[exec.pipeline_id];
    if (!config) return;

    // Reset the failed stage
    const failedIndex = exec.stages.findIndex(s => s.status === 'failed');
    if (failedIndex < 0) return;

    const abortFlag = { aborted: false };
    abortRef.current.set(executionId, abortFlag);

    // Reset failed stage state
    setExecutions(prev => {
      const e = prev[executionId];
      if (!e) return prev;
      const stages = [...e.stages];
      stages[failedIndex] = blankStageExecution(stages[failedIndex].stage_id);
      return {
        ...prev,
        [executionId]: {
          ...e,
          status: 'running',
          stages,
          error: null,
        },
      };
    });

    try {
      for (let i = failedIndex; i < config.stages.length; i++) {
        if (abortFlag.aborted) {
          setExecutions(prev => {
            const e = prev[executionId];
            if (!e) return prev;
            return {
              ...prev,
              [executionId]: {
                ...e,
                status: 'paused',
                current_stage_index: i,
                error: 'Paused by user',
              },
            };
          });
          return;
        }

        await runStage(exec, i, config, abortFlag);
      }

      setExecutions(prev => {
        const e = prev[executionId];
        if (!e) return prev;
        return {
          ...prev,
          [executionId]: {
            ...e,
            status: 'completed',
            current_stage_index: config.stages.length - 1,
            finished_at: new Date().toISOString(),
          },
        };
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setExecutions(prev => {
        const ex = prev[executionId];
        if (!ex) return prev;
        if (ex.status === 'paused') return prev;
        return {
          ...prev,
          [executionId]: {
            ...ex,
            status: 'failed',
            error: msg,
            finished_at: new Date().toISOString(),
          },
        };
      });
    } finally {
      abortRef.current.delete(executionId);
    }
  }, [executions, pipelines, runStage]);

  // -------------------------------------------------------------------------
  // Utility
  // -------------------------------------------------------------------------

  const getExecution = useCallback((executionId: string): PipelineExecution | undefined => {
    return executions[executionId];
  }, [executions]);

  return {
    pipelines,
    executions,
    pipelineIds,
    error,
    loading,
    loadPipelines,
    savePipeline,
    deletePipeline,
    executePipeline,
    pausePipeline,
    resumePipeline,
    retryStage,
    getExecution,
  };
}
