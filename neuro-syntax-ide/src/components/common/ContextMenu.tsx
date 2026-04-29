import React, { useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ContextMenuItemConfig {
  /** Unique key for the menu item. */
  key: string;
  /** Display label. */
  label: string;
  /** Optional lucide icon element. */
  icon?: React.ReactNode;
  /** Optional shortcut hint (e.g. "Del", "F2"). */
  shortcut?: string;
  /** Is this item disabled? */
  disabled?: boolean;
  /** Is this a destructive action (e.g. delete)? Renders with error color. */
  danger?: boolean;
  /** Click handler. */
  onClick: () => void;
}

export interface ContextMenuDivider {
  key: string;
  type: 'divider';
}

export type ContextMenuEntry = ContextMenuItemConfig | ContextMenuDivider;

export interface ContextMenuProps {
  /** X position (client coordinates). */
  x: number;
  /** Y position (client coordinates). */
  y: number;
  /** Menu items and dividers. */
  items: ContextMenuEntry[];
  /** Called when the menu should close. */
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isDivider(entry: ContextMenuEntry): entry is ContextMenuDivider {
  return 'type' in entry && entry.type === 'divider';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, items, onClose }) => {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Use a small delay to avoid closing on the same right-click that opened it
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handler);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handler);
    };
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // Adjust position to stay within viewport
  const adjustPosition = useCallback(() => {
    if (!menuRef.current) return { x, y };
    const rect = menuRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let adjustedX = x;
    let adjustedY = y;
    if (x + rect.width > vw) {
      adjustedX = vw - rect.width - 8;
    }
    if (y + rect.height > vh) {
      adjustedY = vh - rect.height - 8;
    }
    return { x: Math.max(8, adjustedX), y: Math.max(8, adjustedY) };
  }, [x, y]);

  const pos = adjustPosition();

  return (
    <>
      {/* Invisible backdrop to catch clicks */}
      <div className="fixed inset-0 z-[200]" onContextMenu={(e) => { e.preventDefault(); onClose(); }} />
      <AnimatePresence>
        <motion.div
          ref={menuRef}
          initial={{ opacity: 0, scale: 0.95, y: -4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -4 }}
          transition={{ duration: 0.1 }}
          className="fixed z-[201] min-w-[180px] bg-surface-container-high border border-outline-variant/20 rounded-lg shadow-2xl py-1"
          style={{ left: pos.x, top: pos.y }}
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          {items.map((entry) => {
            if (isDivider(entry)) {
              return (
                <div key={entry.key} className="my-1 mx-2 h-px bg-outline-variant/20" />
              );
            }

            const item = entry as ContextMenuItemConfig;
            return (
              <button
                key={item.key}
                disabled={item.disabled}
                onClick={() => {
                  if (!item.disabled) {
                    item.onClick();
                    onClose();
                  }
                }}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-1.5 text-xs transition-colors",
                  item.disabled
                    ? "text-outline-variant cursor-not-allowed"
                    : item.danger
                      ? "text-error hover:bg-error/10"
                      : "text-on-surface-variant hover:bg-primary/10 hover:text-primary"
                )}
              >
                {item.icon && (
                  <span className={cn(
                    "w-4 h-4 flex items-center justify-center shrink-0",
                    item.disabled ? "opacity-40" : ""
                  )}>
                    {item.icon}
                  </span>
                )}
                <span className="flex-1 text-left">{item.label}</span>
                {item.shortcut && (
                  <span className="text-[10px] text-outline font-mono shrink-0">{item.shortcut}</span>
                )}
              </button>
            );
          })}
        </motion.div>
      </AnimatePresence>
    </>
  );
};
