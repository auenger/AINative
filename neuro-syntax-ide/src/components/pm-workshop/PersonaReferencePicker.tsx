import React, { useState, useRef, useEffect } from 'react';
import { cn } from '../../lib/utils';
import { ALL_PERSONAS, type PersonaDefinition } from '../../lib/bmad/persona-definitions';
import type { PartyPersona } from '../../types';

// ─── Types ───

export interface PersonaReferencePickerProps {
  /** Current filter text (the part after @) */
  filter: string;
  /** Callback when a persona is selected */
  onSelect: (persona: PersonaDefinition) => void;
  /** Callback to close the picker */
  onClose: () => void;
}

// ─── Component ───

export const PersonaReferencePicker: React.FC<PersonaReferencePickerProps> = ({
  filter,
  onSelect,
  onClose,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
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
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  // Filter personas by name or title
  const filteredPersonas = ALL_PERSONAS.filter(
    (p) =>
      p.name.toLowerCase().includes(filter.toLowerCase()) ||
      p.title.toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <div
      ref={containerRef}
      className={cn(
        'absolute bottom-full left-0 right-0 mb-1 z-50',
        'bg-surface-container border border-outline-variant/10',
        'rounded-lg shadow-xl max-h-48 overflow-y-auto',
      )}
    >
      {/* Header */}
      <div className="px-3 py-1.5 border-b border-outline-variant/10 bg-surface-container-low">
        <p className="text-[9px] text-on-surface-variant font-medium">
          选择要对话的角色
        </p>
      </div>

      {/* Persona list */}
      {filteredPersonas.length === 0 ? (
        <div className="px-3 py-3 text-center">
          <p className="text-[10px] text-on-surface-variant opacity-60">
            未找到匹配角色
          </p>
        </div>
      ) : (
        filteredPersonas.map((persona) => (
          <button
            key={persona.id}
            onClick={() => onSelect(persona)}
            className={cn(
              'w-full flex items-center gap-2 px-3 py-2 text-[11px] transition-colors text-left',
              'text-on-surface-variant hover:bg-surface-container-highest/50',
            )}
          >
            <span className="text-sm w-6 h-6 rounded-full bg-surface-container-high flex items-center justify-center shrink-0">
              {persona.icon}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-on-surface">{persona.name}</span>
                <span className="text-[9px] text-on-surface-variant">{persona.title}</span>
              </div>
              <p className="text-[9px] text-on-surface-variant/70 truncate">
                {persona.description}
              </p>
            </div>
          </button>
        ))
      )}

      {/* Footer */}
      <div className="px-3 py-1.5 border-t border-outline-variant/10 bg-surface-container-lowest/50">
        <p className="text-[8px] text-on-surface-variant opacity-60">
          输入过滤 | Esc 关闭
        </p>
      </div>
    </div>
  );
};

// ─── Helper: Detect @ mention trigger ───

/**
 * Check if the text cursor is at an @ mention trigger position.
 * Returns the filter text after @, or null if not triggered.
 */
export function detectMentionTrigger(text: string, cursorPos: number): string | null {
  // Find the last @ before cursor
  const textBeforeCursor = text.slice(0, cursorPos);
  const match = textBeforeCursor.match(/@(\w*)$/);
  if (!match) return null;
  return match[1]; // The filter text after @ (may be empty)
}

/**
 * Extract @persona mentions from a message.
 * Returns array of persona IDs found.
 */
export function extractMentions(text: string): string[] {
  const personaIds = ALL_PERSONAS.map((p) => p.id);
  const mentionRegex = /@(\w+)/g;
  const mentions: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = mentionRegex.exec(text)) !== null) {
    const mentionId = match[1].toLowerCase();
    if (personaIds.includes(mentionId)) {
      mentions.push(mentionId);
    }
  }
  return [...new Set(mentions)];
}
