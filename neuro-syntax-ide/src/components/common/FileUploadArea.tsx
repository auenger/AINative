import React, { useState, useRef, useCallback } from 'react';
import {
  Paperclip,
  X,
  FileText,
  Image,
  Music,
  File,
  Trash2,
  Loader2,
  AlertTriangle,
  Upload,
  Sparkles,
  CheckCircle2,
  Zap,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { formatFileSize } from '../../lib/usePMFiles';
import type { PMFileEntry, PMFileUploading } from '../../types';
import type { AnalyzeFileState } from '../../lib/useMultimodalAnalyze';

// ---------------------------------------------------------------------------
// File type icon mapping
// ---------------------------------------------------------------------------

function getFileIcon(fileType: string, name: string) {
  switch (fileType) {
    case 'image':
      return <Image size={14} className="text-blue-400" />;
    case 'audio':
      return <Music size={14} className="text-purple-400" />;
    case 'pdf':
      return <FileText size={14} className="text-red-400" />;
    case 'document':
      return <FileText size={14} className="text-orange-400" />;
    case 'markdown':
      return <FileText size={14} className="text-emerald-400" />;
    case 'spreadsheet':
      return <FileText size={14} className="text-green-400" />;
    case 'data':
      return <FileText size={14} className="text-cyan-400" />;
    case 'archive':
      return <File size={14} className="text-yellow-400" />;
    default: {
      // Fallback: check extension from file name
      const ext = name.split('.').pop()?.toLowerCase() ?? '';
      if (['png', 'jpg', 'jpeg', 'gif', 'bmp', 'svg', 'webp', 'avif', 'ico'].includes(ext)) {
        return <Image size={14} className="text-blue-400" />;
      }
      if (['wav', 'mp3', 'ogg', 'flac', 'aac', 'm4a', 'wma'].includes(ext)) {
        return <Music size={14} className="text-purple-400" />;
      }
      return <File size={14} className="text-on-surface-variant" />;
    }
  }
}

// ---------------------------------------------------------------------------
// FileUploadArea Props
// ---------------------------------------------------------------------------

interface FileUploadAreaProps {
  /** Uploaded file entries. */
  files: PMFileEntry[];
  /** Currently uploading files. */
  uploadingFiles: PMFileUploading[];
  /** Whether the file list is loading. */
  loading: boolean;
  /** Error message to display. */
  error: string | null;
  /** Callback to upload files. */
  onUpload: (files: FileList | File[]) => Promise<void>;
  /** Callback to delete a file. */
  onDelete: (fileName: string) => Promise<void>;
  /** Callback to clear error. */
  onClearError: () => void;
  /** Whether the upload area is disabled (e.g. during streaming). */
  disabled?: boolean;
  /** Callback to analyze a single file. */
  onAnalyzeFile?: (fileName: string) => Promise<void>;
  /** Callback to analyze all files. */
  onAnalyzeAll?: () => Promise<void>;
  /** Whether a specific file has been analyzed. */
  isFileAnalyzed?: (fileName: string) => boolean;
  /** Analysis state for individual files. */
  analyzeStates?: Map<string, AnalyzeFileState>;
  /** Whether analysis is in progress. */
  isAnalyzing?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const FileUploadArea: React.FC<FileUploadAreaProps> = ({
  files,
  uploadingFiles,
  loading,
  error,
  onUpload,
  onDelete,
  onClearError,
  disabled = false,
  onAnalyzeFile,
  onAnalyzeAll,
  isFileAnalyzed,
  analyzeStates,
  isAnalyzing = false,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Drag & Drop handlers ---

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragOver(true);
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (disabled || !e.dataTransfer.files.length) return;
    await onUpload(e.dataTransfer.files);
  }, [disabled, onUpload]);

  // --- File input handler ---

  const handleFileInputChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await onUpload(e.target.files);
      e.target.value = '';
    }
  }, [onUpload]);

  // --- Delete handler ---

  const handleDeleteClick = useCallback((fileName: string) => {
    if (confirmDelete === fileName) {
      onDelete(fileName);
      setConfirmDelete(null);
    } else {
      setConfirmDelete(fileName);
      setTimeout(() => setConfirmDelete(prev => prev === fileName ? null : prev), 3000);
    }
  }, [confirmDelete, onDelete]);

  const hasFiles = files.length > 0 || uploadingFiles.length > 0;

  // Count analyzed files
  const analyzedCount = isFileAnalyzed ? files.filter(f => isFileAnalyzed(f.name)).length : 0;

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "relative transition-all",
        isDragOver && "ring-2 ring-primary/50 ring-offset-1 ring-offset-surface"
      )}
    >
      {/* Drag overlay */}
      {isDragOver && (
        <div className="absolute inset-0 z-10 bg-primary/10 border-2 border-dashed border-primary/40 rounded-lg flex items-center justify-center">
          <div className="flex items-center gap-2 text-primary">
            <Upload size={20} />
            <span className="text-xs font-bold">Drop files to upload</span>
          </div>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="px-3 py-1.5 bg-error/10 border-b border-error/20 text-[10px] text-error flex items-center gap-2">
          <AlertTriangle size={10} className="shrink-0" />
          <span className="flex-1 truncate">{error}</span>
          <button onClick={onClearError} className="text-on-surface-variant hover:text-on-surface shrink-0">
            <X size={9} />
          </button>
        </div>
      )}

      {/* Batch analyze bar */}
      {hasFiles && onAnalyzeAll && files.length > 0 && (
        <div className="px-3 py-1.5 border-b border-outline-variant/10 bg-primary/5 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Sparkles size={10} className="text-primary" />
            <span className="text-[9px] text-on-surface-variant">
              {analyzedCount}/{files.length} analyzed
            </span>
          </div>
          <button
            onClick={onAnalyzeAll}
            disabled={isAnalyzing || disabled}
            className={cn(
              "flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-medium transition-all",
              isAnalyzing || disabled
                ? "text-outline-variant cursor-not-allowed"
                : "text-primary hover:bg-primary/10"
            )}
            title="Analyze all files"
          >
            {isAnalyzing ? (
              <Loader2 size={9} className="animate-spin" />
            ) : (
              <Zap size={9} />
            )}
            {isAnalyzing ? "Analyzing..." : "Analyze All"}
          </button>
        </div>
      )}

      {/* File list (uploaded + uploading) */}
      {hasFiles && (
        <div className="max-h-[120px] overflow-y-auto scroll-hide border-b border-outline-variant/10 bg-surface-container-lowest/30">
          {/* Uploading files */}
          {uploadingFiles.map((uf) => (
            <div key={`up-${uf.name}`} className="flex items-center gap-2 px-3 py-1.5 border-b border-outline-variant/5 last:border-b-0">
              {uf.status === 'uploading' ? (
                <Loader2 size={12} className="text-primary animate-spin shrink-0" />
              ) : uf.status === 'error' ? (
                <AlertTriangle size={12} className="text-error shrink-0" />
              ) : (
                <File size={12} className="text-tertiary shrink-0" />
              )}
              <span className="text-[10px] text-on-surface-variant truncate flex-1">{uf.name}</span>
              {uf.status === 'uploading' && (
                <div className="w-16 h-1 bg-outline-variant/20 rounded-full overflow-hidden shrink-0">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-300"
                    style={{ width: `${uf.progress}%` }}
                  />
                </div>
              )}
            </div>
          ))}

          {/* Uploaded files */}
          {files.map((file) => {
            const isAnalyzed = isFileAnalyzed?.(file.name) ?? false;
            const analyzeState = analyzeStates?.get(file.name);
            const isFileAnalyzing = analyzeState?.status === 'analyzing';
            const isFileError = analyzeState?.status === 'error';

            return (
              <div key={file.path} className="flex items-center gap-2 px-3 py-1.5 border-b border-outline-variant/5 last:border-b-0 group">
                {isFileAnalyzing ? (
                  <Loader2 size={12} className="text-primary animate-spin shrink-0" />
                ) : isAnalyzed ? (
                  <CheckCircle2 size={12} className="text-emerald-400 shrink-0" />
                ) : isFileError ? (
                  <AlertTriangle size={12} className="text-error shrink-0" />
                ) : (
                  getFileIcon(file.file_type, file.name)
                )}
                <span className="text-[10px] text-on-surface truncate flex-1" title={file.name}>
                  {file.name}
                </span>
                <span className="text-[8px] text-on-surface-variant shrink-0">
                  {formatFileSize(file.size)}
                </span>

                {/* Analyze button per file */}
                {onAnalyzeFile && !isFileAnalyzing && !isAnalyzed && (
                  <button
                    onClick={() => onAnalyzeFile(file.name)}
                    disabled={isAnalyzing || disabled}
                    className={cn(
                      "p-0.5 rounded transition-all shrink-0",
                      isAnalyzing || disabled
                        ? "text-outline-variant cursor-not-allowed"
                        : "text-primary hover:bg-primary/10 opacity-0 group-hover:opacity-100"
                    )}
                    title="Analyze this file"
                  >
                    <Sparkles size={10} />
                  </button>
                )}

                {/* Analysis progress indicator */}
                {isFileAnalyzing && (
                  <div className="w-12 h-1 bg-outline-variant/20 rounded-full overflow-hidden shrink-0">
                    <div className="h-full bg-primary rounded-full animate-pulse" style={{ width: '60%' }} />
                  </div>
                )}

                <button
                  onClick={() => handleDeleteClick(file.name)}
                  className={cn(
                    "p-0.5 rounded transition-all shrink-0",
                    confirmDelete === file.name
                      ? "text-error bg-error/10 hover:bg-error/20"
                      : "text-outline-variant hover:text-error opacity-0 group-hover:opacity-100"
                  )}
                  title={confirmDelete === file.name ? "Click again to confirm delete" : "Delete file"}
                >
                  {confirmDelete === file.name ? (
                    <Trash2 size={11} />
                  ) : (
                    <Trash2 size={10} />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Attach Button — to be placed inside the chat input area
// ---------------------------------------------------------------------------

interface AttachButtonProps {
  onClick: () => void;
  disabled?: boolean;
}

export const AttachButton: React.FC<AttachButtonProps> = ({ onClick, disabled }) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "p-1.5 rounded-md transition-colors",
        disabled
          ? "text-outline-variant cursor-not-allowed"
          : "text-on-surface-variant hover:text-primary hover:bg-primary/10"
      )}
      title="Attach files"
    >
      <Paperclip size={16} />
    </button>
  );
};
