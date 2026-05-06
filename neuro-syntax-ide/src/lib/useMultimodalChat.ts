import { useState, useCallback, useRef, useEffect } from 'react';
import type { FileNode, PMFileEntry } from '../types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A file reference attached to a chat message. */
export interface FileReference {
  /** File name. */
  name: string;
  /** Full file path in PMFile directory. */
  path: string;
  /** File type category. */
  fileType: string;
  /** Whether the file has been analyzed (has PMDM report). */
  analyzed: boolean;
  /** PMDM analysis MD file path, if analyzed. */
  analysisPath?: string;
}

/** A chat message enriched with file references. */
export interface MultimodalChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  /** File references attached to this message. */
  fileReferences?: FileReference[];
}

/** Context injection mode. */
export type ContextInjectionMode = 'system-prompt' | 'user-message' | 'auto';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

/** Maximum total characters of analysis context to inject. */
const MAX_CONTEXT_CHARS = 12000;

/** Maximum attachment base64 size in characters (~10 MB raw). */
const MAX_ATTACHMENT_BASE64_LENGTH = 10 * 1024 * 1024 * 1.37; // base64 is ~37% larger

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useMultimodalChat(workspacePath: string) {
  const [referencedFiles, setReferencedFiles] = useState<FileReference[]>([]);
  const [showFilePicker, setShowFilePicker] = useState(false);
  const [filePickerFilter, setFilePickerFilter] = useState<string>('');

  // Cache for PMDM analysis content
  const analysisCache = useRef<Map<string, string>>(new Map());
  // Cache for PMDM file list
  const pmdmFilesCache = useRef<{ name: string; path: string }[]>([]);
  // Cache for PMFile entries
  const pmFileCache = useRef<PMFileEntry[]>([]);
  // Cache for workspace tree (all files & folders)
  const workspaceTreeCache = useRef<PMFileEntry[]>([]);

  // -----------------------------------------------------------------------
  // PMDM & PMFile data loading
  // -----------------------------------------------------------------------

  /** Load PMDM analysis file list. */
  const loadPmdmFiles = useCallback(async () => {
    if (!isTauri || !workspacePath) return;
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const files: { name: string; path: string }[] = await invoke('pmdm_list', { workspacePath });
      pmdmFilesCache.current = files;
    } catch {
      pmdmFilesCache.current = [];
    }
  }, [workspacePath]);

  /** Load PMFile entries. */
  const loadPmFiles = useCallback(async () => {
    if (!isTauri || !workspacePath) return;
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const files: PMFileEntry[] = await invoke('pmfile_list', { workspacePath });
      pmFileCache.current = files;
    } catch {
      pmFileCache.current = [];
    }
  }, [workspacePath]);

  /** Flatten FileNode tree into a list of PMFileEntry-like items. */
  function flattenTree(nodes: FileNode[], prefix: string): PMFileEntry[] {
    const result: PMFileEntry[] = [];
    for (const node of nodes) {
      const display = prefix ? `${prefix}/${node.name}` : node.name;
      result.push({
        name: display,
        path: node.path,
        size: 0,
        file_type: node.isDir ? 'folder' : 'file',
        modified: '',
      });
      if (node.isDir && node.children) {
        result.push(...flattenTree(node.children, display));
      }
    }
    return result;
  }

  /** Load workspace file tree (all files & folders). */
  const loadWorkspaceTree = useCallback(async () => {
    if (!isTauri || !workspacePath) return;
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const tree: FileNode[] = await invoke('read_file_tree', { path: workspacePath });
      workspaceTreeCache.current = flattenTree(tree, '');
    } catch {
      workspaceTreeCache.current = [];
    }
  }, [workspacePath]);

  /** Load analysis content for a specific file. */
  const loadAnalysisContent = useCallback(async (analysisPath: string): Promise<string | null> => {
    // Check cache first
    if (analysisCache.current.has(analysisPath)) {
      return analysisCache.current.get(analysisPath)!;
    }

    if (!isTauri) return null;

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const content: string = await invoke('read_file', { path: analysisPath });
      // Cache the result
      analysisCache.current.set(analysisPath, content);
      return content;
    } catch {
      return null;
    }
  }, []);

  // Load PMDM and PMFile data on mount
  useEffect(() => {
    loadPmdmFiles();
    loadPmFiles();
    loadWorkspaceTree();
  }, [loadPmdmFiles, loadPmFiles, loadWorkspaceTree]);

  // -----------------------------------------------------------------------
  // File reference management
  // -----------------------------------------------------------------------

  /** Add a file reference to the current message. */
  const addFileReference = useCallback((file: PMFileEntry) => {
    setReferencedFiles((prev) => {
      // Don't add duplicates
      if (prev.some((f) => f.name === file.name)) return prev;

      // Check if this file has been analyzed
      const stem = file.name.split('.').slice(0, -1).join('.') || file.name;
      const analysisFile = pmdmFilesCache.current.find(
        (md) => md.name === `${stem}-analysis.md`,
      );

      return [
        ...prev,
        {
          name: file.name,
          path: file.path,
          fileType: file.file_type,
          analyzed: !!analysisFile,
          analysisPath: analysisFile?.path,
        },
      ];
    });
  }, []);

  /** Remove a file reference. */
  const removeFileReference = useCallback((fileName: string) => {
    setReferencedFiles((prev) => prev.filter((f) => f.name !== fileName));
  }, []);

  /** Clear all file references. */
  const clearFileReferences = useCallback(() => {
    setReferencedFiles([]);
  }, []);

  // -----------------------------------------------------------------------
  // @ Mention parsing
  // -----------------------------------------------------------------------

  /** Parse @mentions from input text and resolve to FileReferences. */
  const parseMentions = useCallback(
    (input: string): FileReference[] => {
      const mentions: FileReference[] = [];
      const regex = /@([\w.\-]+)/g;
      let match: RegExpExecArray | null;

      while ((match = regex.exec(input)) !== null) {
        const fileName = match[1];
        const existing = referencedFiles.find((f) => f.name === fileName);
        if (existing) {
          mentions.push(existing);
          continue;
        }

        // Look up in PMFile cache
        const pmFile = pmFileCache.current.find((f) => f.name === fileName);
        if (pmFile) {
          const stem = pmFile.name.split('.').slice(0, -1).join('.') || pmFile.name;
          const analysisFile = pmdmFilesCache.current.find(
            (md) => md.name === `${stem}-analysis.md`,
          );
          mentions.push({
            name: pmFile.name,
            path: pmFile.path,
            fileType: pmFile.file_type,
            analyzed: !!analysisFile,
            analysisPath: analysisFile?.path,
          });
        }
      }

      return mentions;
    },
    [referencedFiles],
  );

  // -----------------------------------------------------------------------
  // Context injection
  // -----------------------------------------------------------------------

  /** Build context string from file references by loading analysis content. */
  const buildFileContext = useCallback(
    async (files: FileReference[]): Promise<string> => {
      if (files.length === 0) return '';

      const contexts: string[] = [];
      let totalChars = 0;

      for (const file of files) {
        if (totalChars >= MAX_CONTEXT_CHARS) break;

        if (file.analyzed && file.analysisPath) {
          const content = await loadAnalysisContent(file.analysisPath);
          if (content) {
            const truncated =
              content.length > MAX_CONTEXT_CHARS - totalChars
                ? content.slice(0, MAX_CONTEXT_CHARS - totalChars) + '\n...(truncated)'
                : content;
            contexts.push(`## File: ${file.name}\n\n${truncated}`);
            totalChars += truncated.length;
          }
        } else {
          // File not analyzed yet — just note its presence
          contexts.push(`## File: ${file.name} (not yet analyzed)\n\nType: ${file.fileType}`);
          totalChars += 50;
        }
      }

      return contexts.length > 0
        ? `\n\n---\n**Referenced File Analysis:**\n\n${contexts.join('\n\n')}\n---\n`
        : '';
    },
    [loadAnalysisContent],
  );

  /** Load all PMDM analysis content for comprehensive analysis. */
  const loadAllAnalysisContent = useCallback(async (): Promise<string> => {
    if (!isTauri || !workspacePath) return '';

    await loadPmdmFiles();

    const contexts: string[] = [];
    let totalChars = 0;

    for (const md of pmdmFilesCache.current) {
      if (totalChars >= MAX_CONTEXT_CHARS) break;

      const content = await loadAnalysisContent(md.path);
      if (content) {
        const truncated =
          content.length > MAX_CONTEXT_CHARS - totalChars
            ? content.slice(0, MAX_CONTEXT_CHARS - totalChars) + '\n...(truncated)'
            : content;
        contexts.push(`## ${md.name}\n\n${truncated}`);
        totalChars += truncated.length;
      }
    }

    return contexts.join('\n\n');
  }, [workspacePath, loadPmdmFiles, loadAnalysisContent]);

  // -----------------------------------------------------------------------
  // Message enrichment
  // -----------------------------------------------------------------------

  /** Load base64 data for an image file from PMFile directory. */
  const loadImageBase64 = useCallback(
    async (filePath: string): Promise<string | null> => {
      if (!isTauri || !workspacePath) return null;
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const result: { base64_content: string | null; text_content: string | null; file_type: string } =
          await invoke('pmfile_read_content', { path: filePath });
        return result.base64_content ?? null;
      } catch {
        return null;
      }
    },
    [workspacePath],
  );

  /** Read text file content from workspace. */
  const readFileContent = useCallback(
    async (filePath: string): Promise<string | null> => {
      if (!isTauri || !workspacePath) return null;
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const content: string = await invoke('read_file', { path: filePath });
        return content;
      } catch {
        return null;
      }
    },
    [workspacePath],
  );

  /** Determine MIME type from file name extension. */
  function getMimeFromName(fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
    const mimeMap: Record<string, string> = {
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      bmp: 'image/bmp',
      svg: 'image/svg+xml',
      webp: 'image/webp',
      avif: 'image/avif',
      ico: 'image/x-icon',
      pdf: 'application/pdf',
    };
    return mimeMap[ext] ?? 'application/octet-stream';
  }

  /** Check if a file is an image based on its name/extension. */
  function isImageFile(fileName: string): boolean {
    const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
    return ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'svg', 'webp', 'avif', 'ico'].includes(ext);
  }

  /** Build attachments array from file references (loads base64 for images, text for files). */
  const buildAttachments = useCallback(
    async (files: FileReference[]): Promise<Array<{
      type: string;
      mime: string;
      data: string;
      name?: string;
      content?: string;
    }>> => {
      if (files.length === 0 || !isTauri) return [];

      const attachments: Array<{
        type: string;
        mime: string;
        data: string;
        name?: string;
        content?: string;
      }> = [];

      for (const file of files) {
        if (isImageFile(file.name)) {
          const base64 = await loadImageBase64(file.path);
          if (base64) {
            // Skip oversized attachments (> 10 MB raw ~ 13.7 MB base64)
            if (base64.length > MAX_ATTACHMENT_BASE64_LENGTH) {
              console.warn(`[Multimodal] Skipping oversized image attachment: ${file.name}`);
              continue;
            }
            attachments.push({
              type: 'image',
              mime: getMimeFromName(file.name),
              data: base64,
            });
          }
        } else {
          // For non-image files, load text content
          const textContent = await readFileContent(file.path);
          if (textContent) {
            attachments.push({
              type: 'file',
              mime: getMimeFromName(file.name),
              data: '', // no base64 for text files
              name: file.name,
              content: textContent.length > 50000
                ? textContent.slice(0, 50000) + '\n...(truncated)'
                : textContent,
            });
          }
        }
      }

      return attachments;
    },
    [loadImageBase64, readFileContent],
  );

  /** Enrich a user message with file context.
   *  Returns the enriched message, resolved file references, and multimodal attachments. */
  const enrichMessage = useCallback(
    async (input: string): Promise<{
      enrichedContent: string;
      resolvedReferences: FileReference[];
      attachments: Array<{
        type: string;
        mime: string;
        data: string;
        name?: string;
        content?: string;
      }>;
    }> => {
      // Parse @mentions from input
      const mentions = parseMentions(input);

      // Merge with explicitly referenced files
      const allFiles = [...referencedFiles];
      for (const mention of mentions) {
        if (!allFiles.some((f) => f.name === mention.name)) {
          allFiles.push(mention);
        }
      }

      // Build context from file references (text-based analysis summaries)
      const context = await buildFileContext(allFiles);

      // Build multimodal attachments (base64 images, file content)
      const attachments = await buildAttachments(allFiles);

      const enrichedContent = context
        ? `${input}${context}`
        : input;

      return {
        enrichedContent,
        resolvedReferences: allFiles,
        attachments,
      };
    },
    [parseMentions, referencedFiles, buildFileContext, buildAttachments],
  );

  // -----------------------------------------------------------------------
  // System prompt enhancement
  // -----------------------------------------------------------------------

  /** Build an enhanced system prompt with all PMDM context for auto-awareness. */
  const buildContextAwareSystemPrompt = useCallback(
    async (basePrompt: string): Promise<string> => {
      const allContext = await loadAllAnalysisContent();
      if (!allContext) return basePrompt;

      return `${basePrompt}

You have access to the following file analysis reports from the project workspace. Use them proactively when relevant to the user's questions:

${allContext}

When referencing file content, cite the source file name. If multiple files are relevant, synthesize information across them.`;
    },
    [loadAllAnalysisContent],
  );

  // -----------------------------------------------------------------------
  // File picker helpers
  // -----------------------------------------------------------------------

  /** Get available files for the picker — workspace tree (all files & folders). */
  const getAvailableFiles = useCallback((): PMFileEntry[] => {
    const files = workspaceTreeCache.current;
    if (!filePickerFilter) return files;
    const lower = filePickerFilter.toLowerCase();
    return files.filter((f) => f.name.toLowerCase().includes(lower));
  }, [filePickerFilter]);

  /** Open the file picker. */
  const openFilePicker = useCallback(() => {
    loadWorkspaceTree();
    loadPmFiles();
    loadPmdmFiles();
    setFilePickerFilter('');
    setShowFilePicker(true);
  }, [loadWorkspaceTree, loadPmFiles, loadPmdmFiles]);

  /** Close the file picker. */
  const closeFilePicker = useCallback(() => {
    setShowFilePicker(false);
    setFilePickerFilter('');
  }, []);

  /** Update the file picker filter text. */
  const updateFilePickerFilter = useCallback((filter: string) => {
    setFilePickerFilter(filter);
  }, []);

  // -----------------------------------------------------------------------
  // Comprehensive report generation
  // -----------------------------------------------------------------------

  /** Generate a comprehensive cross-file analysis report.
   *  Writes the result to {workspace}/PMDM/综合分析-{timestamp}.md */
  const generateComprehensiveReport = useCallback(
    async (customPrompt?: string): Promise<string | null> => {
      if (!isTauri || !workspacePath) return null;

      const allContext = await loadAllAnalysisContent();
      if (!allContext) return null;

      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const fileName = `综合分析-${timestamp}.md`;
        const filePath = `${workspacePath}/PMDM/${fileName}`;

        const prompt = customPrompt || '请基于以下所有文件分析报告，生成一份综合需求分析报告，包括：\n1. 项目整体概述\n2. 各文件关键信息汇总\n3. 跨文件关联分析\n4. 需求优先级建议\n5. 潜在风险和注意事项';

        const reportContent = `# 综合需求分析报告

生成时间: ${new Date().toLocaleString()}

${prompt}

---

## 分析数据源

${allContext}

---

*此报告由 Neuro Syntax IDE 多模态分析引擎自动生成。`;

        await invoke('write_file', { path: filePath, content: reportContent });
        return filePath;
      } catch (e) {
        console.error('Failed to generate comprehensive report:', e);
        return null;
      }
    },
    [workspacePath, loadAllAnalysisContent],
  );

  // -----------------------------------------------------------------------
  // Return
  // -----------------------------------------------------------------------

  return {
    // File references
    referencedFiles,
    addFileReference,
    removeFileReference,
    clearFileReferences,

    // Message enrichment
    enrichMessage,
    buildContextAwareSystemPrompt,
    buildFileContext,

    // File picker
    showFilePicker,
    openFilePicker,
    closeFilePicker,
    filePickerFilter,
    updateFilePickerFilter,
    getAvailableFiles,

    // Comprehensive report
    generateComprehensiveReport,

    // Data refresh
    loadPmFiles,
    loadPmdmFiles,
    loadWorkspaceTree,
  };
}
