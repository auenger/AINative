import type { FileRendererType } from '../types';

// ---------------------------------------------------------------------------
// File extension → Renderer type mapping
// To add a new file type, just add a case below or extend the SETS.
// ---------------------------------------------------------------------------

/** Image extensions. */
const IMAGE_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'bmp', 'ico', 'svg', 'webp', 'avif',
]);

/** Config / data file extensions rendered as a structured tree view. */
const CONFIG_EXTENSIONS = new Set([
  'yaml', 'yml', 'toml', 'ini', 'env', 'conf',
]);

/** Markdown extensions. */
const MARKDOWN_EXTENSIONS = new Set([
  'md', 'mdx',
]);

/** PDF extensions. */
const PDF_EXTENSIONS = new Set([
  'pdf',
]);

/** Video extensions. */
const VIDEO_EXTENSIONS = new Set([
  'mp4', 'webm', 'mov', 'avi', 'mkv',
]);

/** Audio extensions. */
const AUDIO_EXTENSIONS = new Set([
  'mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a',
]);

/** Source code extensions handled by Monaco editor with full language support. */
const MONACO_CODE_EXTENSIONS = new Set([
  'ts', 'tsx', 'js', 'jsx',
  'rs', 'py', 'go', 'java', 'kt', 'kts',
  'c', 'cpp', 'h', 'hpp', 'm', 'mm',
  'cs', 'swift', 'rb', 'php',
  'vue', 'svelte',
  'sh', 'bash', 'zsh', 'fish',
  'sql', 'graphql', 'gql',
  'dockerfile',
  'json', 'jsonc',
  'css', 'scss', 'less', 'sass',
  'html', 'htm', 'xml', 'svg',
]);

/**
 * Determine the renderer type for a file based on its extension.
 *
 * @param filePath - Absolute or relative file path.
 * @returns The appropriate `FileRendererType`.
 */
export function getFileRendererType(filePath: string): FileRendererType {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';

  // Special filename-based checks (no extension)
  const basename = filePath.split('/').pop()?.toLowerCase() ?? '';
  if (basename === 'dockerfile' || basename === 'makefile' || basename === 'gemfile') {
    return 'monaco';
  }

  if (MARKDOWN_EXTENSIONS.has(ext)) return 'markdown';
  if (PDF_EXTENSIONS.has(ext)) return 'pdf';
  if (VIDEO_EXTENSIONS.has(ext)) return 'media';
  if (AUDIO_EXTENSIONS.has(ext)) return 'media';
  if (IMAGE_EXTENSIONS.has(ext)) return 'image';
  if (CONFIG_EXTENSIONS.has(ext)) return 'config-tree';
  if (MONACO_CODE_EXTENSIONS.has(ext)) return 'monaco';
  if (ext === 'txt' || ext === 'log' || ext === 'csv') return 'text';

  // Fallback: try Monaco for anything else (plaintext mode)
  return 'text';
}
