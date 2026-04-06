import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  FileText,
  Image,
  Music,
  File,
  CheckCircle2,
  Search,
  X,
  Sparkles,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { formatFileSize } from '../../lib/usePMFiles';
import type { PMFileEntry } from '../../types';

// ---------------------------------------------------------------------------
// File type icon mapping (reused from FileUploadArea)
// ---------------------------------------------------------------------------

function getFileIcon(fileType: string, name: string) {
  switch (fileType) {
    case 'image':
      return <Image size={12} className="text-blue-400" />;
    case 'audio':
      return <Music size={12} className="text-purple-400" />;
    case 'pdf':
      return <FileText size={12} className="text-red-400" />;
    case 'document':
      return <FileText size={12} className="text-orange-400" />;
    case 'markdown':
      return <FileText size={12} className="text-emerald-400" />;
    default: {
      const ext = name.split('.').pop()?.toLowerCase() ?? '';
      if (['png', 'jpg', 'jpeg', 'gif', 'bmp', 'svg', 'webp', 'avif', 'ico'].includes(ext)) {
        return <Image size={12} className="text-blue-400" />;
      }
      if (['wav', 'mp3', 'ogg', 'flac', 'aac', 'm4a', 'wma'].includes(ext)) {
        return <Music size={12} className="text-purple-400" />;
      }
      return <File size={12} className="text-on-surface-variant" />;
    }
  }
}

// ---------------------------------------------------------------------------
// FileReferencePicker Props
// ---------------------------------------------------------------------------

export interface FileReferencePickerProps {
  /** Available files to pick from. */
  files: PMFileEntry[];
  /** Currently referenced file names. */
  referencedNames: string[];
  /** Filter text for searching. */
  filter: string;
  /** Callback when filter changes. */
  onFilterChange: (filter: string) => void;
  /** Callback when a file is selected. */
  onSelect: (file: PMFileEntry) => void;
  /** Callback when a file is deselected. */
  onDeselect: (fileName: string) => void;
  /** Callback to close the picker. */
  onClose: () => void;
  /** Whether a specific file has been analyzed. */
  isFileAnalyzed?: (fileName: string) => boolean;
  /** Position to anchor the picker (optional, defaults to above input). */
  position?: 'above' | 'below';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const FileReferencePicker: React.FC<FileReferencePickerProps> = ({
  files,
  referencedNames,
  filter,
  onFilterChange,
  onSelect,
  onDeselect,
  onClose,
  isFileAnalyzed,
  position = 'above',
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-focus the input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Delay to avoid capturing the same click that opened the picker
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  const filteredFiles = files.filter((f) =>
    f.name.toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <div
      ref={containerRef}
      className={cn(
        "absolute left-0 right-0 z-50 bg-surface-container-high border border-outline-variant/20 rounded-lg shadow-xl overflow-hidden",
        position === 'above' ? "bottom-full mb-1" : "top-full mt-1",
      )}
    >
      {/* Search input */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-outline-variant/10 bg-surface-container-low">
        <Search size={12} className="text-on-surface-variant shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={filter}
          onChange={(e) => onFilterChange(e.target.value)}
          placeholder="Search files..."
          className="flex-1 bg-transparent text-[11px] text-on-surface placeholder:text-outline focus:outline-none"
        />
        <button
          onClick={onClose}
          className="p-0.5 text-on-surface-variant hover:text-on-surface transition-colors"
        >
          <X size={10} />
        </button>
      </div>

      {/* File list */}
      <div className="max-h-[180px] overflow-y-auto scroll-hide">
        {filteredFiles.length === 0 ? (
          <div className="px-3 py-4 text-center">
            <FileText size={16} className="text-outline-variant mx-auto mb-1 opacity-40" />
            <p className="text-[10px] text-on-surface-variant opacity-60">
              {files.length === 0 ? 'No files uploaded yet' : 'No matching files'}
            </p>
          </div>
        ) : (
          filteredFiles.map((file) => {
            const isReferenced = referencedNames.includes(file.name);
            const isAnalyzed = isFileAnalyzed?.(file.name) ?? false;

            return (
              <button
                key={file.path}
                onClick={() => {
                  if (isReferenced) {
                    onDeselect(file.name);
                  } else {
                    onSelect(file);
                  }
                }}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-1.5 text-[11px] transition-colors text-left",
                  isReferenced
                    ? "bg-primary/10 text-primary"
                    : "text-on-surface-variant hover:bg-surface-container-highest/50",
                )}
              >
                {isReferenced ? (
                  <CheckCircle2 size={12} className="text-primary shrink-0" />
                ) : (
                  getFileIcon(file.file_type, file.name)
                )}
                <span className="truncate flex-1">{file.name}</span>
                <span className="text-[8px] text-on-surface-variant shrink-0">
                  {formatFileSize(file.size)}
                </span>
                {isAnalyzed && (
                  <Sparkles size={9} className="text-emerald-400 shrink-0" />
                )}
              </button>
            );
          })
        )}
      </div>

      {/* Footer hint */}
      <div className="px-3 py-1.5 border-t border-outline-variant/10 bg-surface-container-lowest/50">
        <p className="text-[8px] text-on-surface-variant opacity-60">
          Click to toggle reference | Esc to close | {filteredFiles.length} file{filteredFiles.length !== 1 ? 's' : ''}
        </p>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// FileReferenceTag — inline tag for referenced files
// ---------------------------------------------------------------------------

interface FileReferenceTagProps {
  name: string;
  analyzed: boolean;
  onRemove: () => void;
}

export const FileReferenceTag: React.FC<FileReferenceTagProps> = ({
  name,
  analyzed,
  onRemove,
}) => {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium border",
        analyzed
          ? "bg-primary/10 text-primary border-primary/20"
          : "bg-outline-variant/10 text-on-surface-variant border-outline-variant/10",
      )}
    >
      {analyzed && <Sparkles size={8} className="shrink-0" />}
      <span className="truncate max-w-[80px]">@{name}</span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="p-0.5 hover:text-error transition-colors shrink-0"
      >
        <X size={8} />
      </button>
    </span>
  );
};

// ---------------------------------------------------------------------------
// FileAttachmentCard — shown in message bubbles for referenced files
// ---------------------------------------------------------------------------

interface FileAttachmentCardProps {
  name: string;
  fileType: string;
  analyzed: boolean;
  onClick?: () => void;
}

export const FileAttachmentCard: React.FC<FileAttachmentCardProps> = ({
  name,
  fileType,
  analyzed,
  onClick,
}) => {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-2 py-1.5 rounded border text-[10px] transition-colors",
        analyzed
          ? "bg-primary/5 border-primary/15 text-primary hover:bg-primary/10"
          : "bg-surface-container-high/50 border-outline-variant/10 text-on-surface-variant hover:bg-surface-container-high",
      )}
    >
      {getFileIcon(fileType, name)}
      <span className="truncate max-w-[120px]">{name}</span>
      {analyzed && (
        <span className="text-[7px] uppercase font-bold text-emerald-400 bg-emerald-400/10 px-1 rounded">
          analyzed
        </span>
      )}
    </button>
  );
};
