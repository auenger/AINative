import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, X } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface DeleteConfirmDialogProps {
  /** The file/dir name being deleted. */
  entryName: string;
  /** Whether the entry is a directory. */
  isDir: boolean;
  /** Called when user confirms delete. */
  onConfirm: () => void;
  /** Called when user cancels. */
  onCancel: () => void;
}

export const DeleteConfirmDialog: React.FC<DeleteConfirmDialogProps> = ({
  entryName,
  isDir,
  onConfirm,
  onCancel,
}) => {
  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onCancel}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />
        {/* Dialog */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="relative w-full max-w-sm bg-surface-container-low border border-outline-variant/20 rounded-xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="p-4 border-b border-outline-variant/10 flex items-center gap-3 bg-error/5">
            <div className="p-2 bg-error/10 rounded-lg">
              <AlertTriangle size={18} className="text-error" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-on-surface">Confirm Delete</h3>
              <p className="text-[10px] text-on-surface-variant mt-0.5">
                This action cannot be undone.
              </p>
            </div>
            <button
              onClick={onCancel}
              className="p-1.5 hover:bg-surface-container-high rounded-full transition-colors text-on-surface-variant"
            >
              <X size={16} />
            </button>
          </div>

          {/* Body */}
          <div className="p-5">
            <p className="text-xs text-on-surface-variant leading-relaxed">
              {isDir
                ? `Are you sure you want to delete the folder "${entryName}" and all its contents?`
                : `Are you sure you want to delete "${entryName}"?`}
            </p>
          </div>

          {/* Footer */}
          <div className="p-4 bg-surface-container-high/30 border-t border-outline-variant/10 flex justify-end gap-2">
            <button
              onClick={onCancel}
              className="px-4 py-2 bg-surface-container-highest text-on-surface rounded-lg text-xs font-bold hover:bg-surface-variant transition-all border border-outline-variant/10"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="px-4 py-2 bg-error text-on-primary rounded-lg text-xs font-bold hover:brightness-110 transition-all"
            >
              Delete
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
