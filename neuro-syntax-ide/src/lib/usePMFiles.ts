import { useState, useCallback, useEffect } from 'react';
import type { PMFileEntry, PMFileUploading } from '../types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

/** Maximum file size in bytes (50 MB). */
const MAX_FILE_SIZE = 50 * 1024 * 1024;

/** Allowed MIME type prefixes and specific types. */
const ALLOWED_MIME_PREFIXES = [
  'image/',
  'audio/',
  'text/',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument',
  'application/vnd.oasis.opendocument',
];

/** Allowed file extensions (fallback when MIME type is empty). */
const ALLOWED_EXTENSIONS = new Set([
  // Images
  'png', 'jpg', 'jpeg', 'gif', 'bmp', 'svg', 'webp', 'avif', 'ico',
  // Audio
  'wav', 'mp3', 'ogg', 'flac', 'aac', 'm4a', 'wma',
  // Documents
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
  'odt', 'ods', 'odp',
  // Text / code
  'md', 'mdx', 'txt', 'csv', 'json', 'yaml', 'yml', 'xml', 'html', 'css',
  'ts', 'tsx', 'js', 'jsx', 'py', 'rs', 'go', 'java',
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Get extension from file name. */
function getExtension(name: string): string {
  const parts = name.split('.');
  return parts.length > 1 ? parts.pop()!.toLowerCase() : '';
}

/** Check if a file's MIME type or extension is allowed. */
export function isAllowedFile(file: { name: string; type: string; size: number }): string | null {
  // Size check
  if (file.size > MAX_FILE_SIZE) {
    return `文件 "${file.name}" 超过 50MB 大小限制`;
  }

  // MIME type check
  const mimeOk = file.type && ALLOWED_MIME_PREFIXES.some(prefix => file.type.startsWith(prefix));
  if (mimeOk) return null;

  // Extension fallback
  const ext = getExtension(file.name);
  if (ext && ALLOWED_EXTENSIONS.has(ext)) return null;

  return `不支持该文件类型: "${file.name}"`;
}

/** Format bytes to human-readable string. */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function usePMFiles(workspacePath: string) {
  const [files, setFiles] = useState<PMFileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadingFiles, setUploadingFiles] = useState<PMFileUploading[]>([]);

  /** Fetch the file list from the backend. */
  const refresh = useCallback(async () => {
    if (!workspacePath) {
      setFiles([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (isTauri) {
        const { invoke } = await import('@tauri-apps/api/core');
        const result: PMFileEntry[] = await invoke('pmfile_list', { workspacePath });
        setFiles(result);
      } else {
        // Dev fallback: empty list
        setFiles([]);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [workspacePath]);

  /** Upload files to PMFile directory via byte transfer. */
  const uploadFiles = useCallback(async (fileList: FileList | File[]) => {
    if (!workspacePath) return;

    const filesToProcess = Array.from(fileList);
    const validFiles: File[] = [];
    const errors: string[] = [];

    // Validate all files first
    for (const file of filesToProcess) {
      const validationError = isAllowedFile(file);
      if (validationError) {
        errors.push(validationError);
      } else {
        validFiles.push(file);
      }
    }

    // Show validation errors immediately
    if (errors.length > 0) {
      setError(errors.join('; '));
    } else {
      setError(null);
    }

    if (validFiles.length === 0) return;

    // Add uploading entries
    const newUploading: PMFileUploading[] = validFiles.map(f => ({
      name: f.name,
      progress: 0,
      status: 'uploading' as const,
    }));
    setUploadingFiles(prev => [...prev, ...newUploading]);

    try {
      if (isTauri) {
        const { invoke } = await import('@tauri-apps/api/core');

        // Upload files one by one using byte transfer
        for (let i = 0; i < validFiles.length; i++) {
          const file = validFiles[i];
          const arrayBuffer = await file.arrayBuffer();
          const bytes = Array.from(new Uint8Array(arrayBuffer));

          setUploadingFiles(prev => {
            const updated = [...prev];
            const idx = prev.findIndex(u => u.name === file.name && u.status === 'uploading');
            if (idx >= 0) updated[idx] = { ...updated[idx], progress: 50 };
            return updated;
          });

          await invoke('pmfile_upload_bytes', {
            workspacePath,
            fileName: file.name,
            fileBytes: bytes,
          });

          setUploadingFiles(prev => {
            const updated = [...prev];
            const idx = prev.findIndex(u => u.name === file.name && u.status === 'uploading');
            if (idx >= 0) updated[idx] = { ...updated[idx], progress: 100, status: 'uploaded' };
            return updated;
          });
        }
      } else {
        // Dev fallback: simulate upload
        for (let i = 0; i < validFiles.length; i++) {
          const file = validFiles[i];
          setUploadingFiles(prev => {
            const updated = [...prev];
            const idx = prev.findIndex(u => u.name === file.name && u.status === 'uploading');
            if (idx >= 0) updated[idx] = { ...updated[idx], progress: 100, status: 'uploaded' };
            return updated;
          });
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setUploadingFiles(prev =>
        prev.map(u => (u.status === 'uploading' ? { ...u, status: 'error' as const, error: msg } : u))
      );
    }

    // Refresh file list and clean up uploading entries after a short delay
    await refresh();
    setTimeout(() => {
      setUploadingFiles(prev => prev.filter(u => u.status === 'uploading'));
    }, 1500);
  }, [workspacePath, refresh]);

  /** Delete a file from PMFile directory. */
  const deleteFile = useCallback(async (fileName: string) => {
    if (!workspacePath) return;
    try {
      if (isTauri) {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('pmfile_delete', { workspacePath, fileName });
      }
      await refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    }
  }, [workspacePath, refresh]);

  /** Rename a file in PMFile directory. */
  const renameFile = useCallback(async (oldName: string, newName: string) => {
    if (!workspacePath || !newName.trim()) return;
    try {
      if (isTauri) {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('pmfile_rename', { workspacePath, oldName, newName });
      }
      await refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    }
  }, [workspacePath, refresh]);

  // Auto-refresh when workspace changes
  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    files,
    uploadingFiles,
    loading,
    error,
    refresh,
    uploadFiles,
    deleteFile,
    renameFile,
    setError,
  };
}
