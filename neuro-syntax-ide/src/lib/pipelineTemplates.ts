import type { PipelineConfig } from '../types';

// ---------------------------------------------------------------------------
// Pre-built pipeline templates
// ---------------------------------------------------------------------------

/** Full development pipeline: requirement analysis -> code generation -> code review. */
export const TEMPLATE_FULL_DEV: PipelineConfig = {
  id: 'template-full-dev',
  name: 'Full Development Pipeline',
  description: 'Requirement analysis -> Code generation -> Code review',
  stages: [
    {
      id: 'req-analysis',
      name: 'Requirement Analysis',
      runtime_id: 'claude-code',
      prompt_template:
        'Analyze the following requirement and produce a detailed technical specification:\n\n{{input}}',
      max_retries: 1,
      timeout_seconds: 120,
    },
    {
      id: 'code-gen',
      name: 'Code Generation',
      runtime_id: 'codex',
      prompt_template:
        'Based on the following technical specification, generate implementation code:\n\n{{prev_output}}',
      input_mapping: {
        context: '{{input}}',
      },
      max_retries: 2,
      timeout_seconds: 180,
    },
    {
      id: 'code-review',
      name: 'Code Review',
      runtime_id: 'claude-code',
      prompt_template:
        'Review the following code for correctness, security, and style. Provide actionable feedback:\n\n{{prev_output}}',
      max_retries: 1,
      timeout_seconds: 120,
    },
  ],
  variables: {},
  default_max_retries: 1,
};

/** Quick analysis pipeline: requirement analysis only. */
export const TEMPLATE_QUICK_ANALYSIS: PipelineConfig = {
  id: 'template-quick-analysis',
  name: 'Quick Analysis',
  description: 'Single-step requirement analysis',
  stages: [
    {
      id: 'analyze',
      name: 'Analyze',
      runtime_id: 'claude-code',
      prompt_template:
        'Analyze the following and provide a concise summary with action items:\n\n{{input}}',
      max_retries: 0,
      timeout_seconds: 60,
    },
  ],
  variables: {},
};

/** Code review pipeline: takes code as input and produces review. */
export const TEMPLATE_CODE_REVIEW: PipelineConfig = {
  id: 'template-code-review',
  name: 'Code Review',
  description: 'Review code for quality, security, and best practices',
  stages: [
    {
      id: 'review',
      name: 'Review Code',
      runtime_id: 'claude-code',
      prompt_template:
        'Perform a thorough code review on the following code. Check for:\n1. Bugs and logic errors\n2. Security vulnerabilities\n3. Performance issues\n4. Code style and readability\n\nCode:\n{{input}}',
      max_retries: 1,
      timeout_seconds: 120,
    },
    {
      id: 'suggest-fixes',
      name: 'Suggest Fixes',
      runtime_id: 'claude-code',
      prompt_template:
        'Based on the review feedback below, provide concrete code fixes:\n\n{{prev_output}}\n\nOriginal code:\n{{input}}',
      max_retries: 1,
      timeout_seconds: 120,
    },
  ],
  variables: {},
  default_max_retries: 1,
};

/** All built-in templates. */
export const PIPELINE_TEMPLATES: PipelineConfig[] = [
  TEMPLATE_FULL_DEV,
  TEMPLATE_QUICK_ANALYSIS,
  TEMPLATE_CODE_REVIEW,
];

/** Get a template by id. */
export function getTemplate(id: string): PipelineConfig | undefined {
  return PIPELINE_TEMPLATES.find(t => t.id === id);
}

/** Create a new pipeline config from a template with a new id and name. */
export function instantiateTemplate(
  templateId: string,
  newId: string,
  newName: string,
  overrides?: Partial<PipelineConfig>,
): PipelineConfig | undefined {
  const tpl = getTemplate(templateId);
  if (!tpl) return undefined;

  return {
    ...tpl,
    ...overrides,
    id: newId,
    name: newName,
    stages: tpl.stages.map(s => ({ ...s })),
  };
}
