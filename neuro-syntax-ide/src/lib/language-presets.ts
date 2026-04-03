import type { editor as MonacoEditor } from 'monaco-editor';

// ---------------------------------------------------------------------------
// Language-specific Monaco editor option presets
//
// Each preset is a partial set of editor options that will be merged with the
// base options in EditorView.  To add a new language, just add an entry to
// `LANGUAGE_PRESETS` below.
// ---------------------------------------------------------------------------

/** Shape of a single language preset. */
export type LanguagePreset = Partial<MonacoEditor.IStandaloneEditorConstructionOptions>;

// -- Individual presets -----------------------------------------------------

const typescriptPreset: LanguagePreset = {
  tabSize: 2,
  insertSpaces: true,
  wordWrap: 'off',
  minimap: { enabled: true, scale: 1 },
  // TypeScript-specific: auto import suggestions
  // (Monaco handles this via language defaults; no direct editor option needed)
};

const javascriptPreset: LanguagePreset = {
  tabSize: 2,
  insertSpaces: true,
  wordWrap: 'off',
  minimap: { enabled: true, scale: 1 },
};

const rustPreset: LanguagePreset = {
  tabSize: 4,
  insertSpaces: true,
  wordWrap: 'off',
  minimap: { enabled: true, scale: 2 },
};

const pythonPreset: LanguagePreset = {
  tabSize: 4,
  insertSpaces: true,
  wordWrap: 'off',
  minimap: { enabled: true, scale: 1 },
};

const vuePreset: LanguagePreset = {
  tabSize: 2,
  insertSpaces: true,
  wordWrap: 'off',
  minimap: { enabled: true, scale: 1 },
};

const sveltePreset: LanguagePreset = {
  tabSize: 2,
  insertSpaces: true,
  wordWrap: 'off',
  minimap: { enabled: true, scale: 1 },
};

const javaPreset: LanguagePreset = {
  tabSize: 4,
  insertSpaces: true,
  wordWrap: 'off',
  minimap: { enabled: true, scale: 1 },
};

const kotlinPreset: LanguagePreset = {
  tabSize: 4,
  insertSpaces: true,
  wordWrap: 'off',
  minimap: { enabled: true, scale: 1 },
};

const goPreset: LanguagePreset = {
  tabSize: 4,
  insertSpaces: true, // gofmt uses tabs, but editor default is fine
  wordWrap: 'off',
  minimap: { enabled: true, scale: 1 },
};

const htmlPreset: LanguagePreset = {
  tabSize: 2,
  insertSpaces: true,
  wordWrap: 'on',
  minimap: { enabled: false },
};

const cssPreset: LanguagePreset = {
  tabSize: 2,
  insertSpaces: true,
  wordWrap: 'on',
  minimap: { enabled: false },
};

const markdownPreset: LanguagePreset = {
  tabSize: 2,
  insertSpaces: true,
  wordWrap: 'on',
  minimap: { enabled: false },
  lineNumbers: 'off',
};

const jsonPreset: LanguagePreset = {
  tabSize: 2,
  insertSpaces: true,
  wordWrap: 'off',
  minimap: { enabled: false },
};

const yamlPreset: LanguagePreset = {
  tabSize: 2,
  insertSpaces: true,
  wordWrap: 'off',
  minimap: { enabled: false },
};

const shellPreset: LanguagePreset = {
  tabSize: 2,
  insertSpaces: true,
  wordWrap: 'off',
  minimap: { enabled: false },
};

const sqlPreset: LanguagePreset = {
  tabSize: 2,
  insertSpaces: true,
  wordWrap: 'off',
  minimap: { enabled: false },
};

const cPreset: LanguagePreset = {
  tabSize: 4,
  insertSpaces: true,
  wordWrap: 'off',
  minimap: { enabled: true, scale: 1 },
};

const cppPreset: LanguagePreset = {
  tabSize: 4,
  insertSpaces: true,
  wordWrap: 'off',
  minimap: { enabled: true, scale: 1 },
};

// -- Preset map: Monaco language id → preset --------------------------------

const LANGUAGE_PRESETS: Record<string, LanguagePreset> = {
  typescript: typescriptPreset,
  javascript: javascriptPreset,
  rust: rustPreset,
  python: pythonPreset,
  html: htmlPreset,
  vue: vuePreset,
  svelte: sveltePreset,
  css: cssPreset,
  scss: cssPreset,
  less: cssPreset,
  markdown: markdownPreset,
  json: jsonPreset,
  yaml: yamlPreset,
  java: javaPreset,
  kotlin: kotlinPreset,
  go: goPreset,
  shell: shellPreset,
  sql: sqlPreset,
  ini: yamlPreset,        // TOML etc. use yaml-like config
  c: cPreset,
  cpp: cppPreset,
};

// -- Public API -------------------------------------------------------------

/**
 * Get language-specific editor options merged on top of base options.
 *
 * @param language - Monaco language identifier (e.g. "typescript", "rust").
 * @param baseOptions - The base editor options (from EditorView).
 * @returns Merged editor options with language-specific overrides.
 */
export function getEditorOptionsForLanguage(
  language: string,
  baseOptions: MonacoEditor.IStandaloneEditorConstructionOptions,
): MonacoEditor.IStandaloneEditorConstructionOptions {
  const preset = LANGUAGE_PRESETS[language];
  if (!preset) return baseOptions;
  return { ...baseOptions, ...preset };
}

/**
 * Check if a language has a dedicated preset.
 */
export function hasLanguagePreset(language: string): boolean {
  return language in LANGUAGE_PRESETS;
}
