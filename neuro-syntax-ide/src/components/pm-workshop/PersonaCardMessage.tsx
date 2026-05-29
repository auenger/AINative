import React from 'react';
import { cn } from '../../lib/utils';
import { MarkdownRenderer } from '../common/MarkdownRenderer';
import { ACCENT_CLASS_MAP } from '../../lib/bmad/persona-definitions';

// ─── Types ───

export interface PersonaCardMessageProps {
  /** Persona ID (for accent color lookup) */
  personaId: string;
  /** Display name */
  personaName: string;
  /** Role title */
  personaTitle: string;
  /** Emoji icon */
  personaIcon: string;
  /** Accent color key (blue/amber/emerald/red/purple) */
  accentColor: string;
  /** Response content (markdown) */
  content: string;
  /** Whether this card is currently streaming */
  isStreaming?: boolean;
  /** Whether in loading/skeleton state */
  isLoading?: boolean;
}

// ─── Component ───

export const PersonaCardMessage: React.FC<PersonaCardMessageProps> = ({
  personaId,
  personaName,
  personaTitle,
  personaIcon,
  accentColor,
  content,
  isStreaming = false,
  isLoading = false,
}) => {
  const accent = ACCENT_CLASS_MAP[accentColor] ?? ACCENT_CLASS_MAP['blue'];

  if (isLoading) {
    return (
      <div
        className={cn(
          'bg-surface-container-low rounded-lg overflow-hidden max-w-[85%] border-l-3',
          accent.border,
        )}
        data-persona={personaId}
      >
        {/* Header */}
        <div className={cn('flex items-center gap-2 px-3 py-2', accent.bgLight)}>
          <div
            className={cn(
              'w-7 h-7 rounded-full flex items-center justify-center text-sm',
              accent.bg,
            )}
          >
            {personaIcon}
          </div>
          <span className="text-xs font-bold text-on-surface">{personaName}</span>
          <span
            className={cn(
              'text-[9px] px-1.5 py-0.5 rounded font-medium',
              accent.bg,
              accent.text,
            )}
          >
            {personaTitle}
          </span>
        </div>
        {/* Skeleton body */}
        <div className={cn('h-16 animate-pulse', accent.bgLight)} />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'bg-surface-container-low rounded-lg overflow-hidden max-w-[85%] border-l-3',
        accent.border,
      )}
      data-persona={personaId}
    >
      {/* Header */}
      <div className={cn('flex items-center gap-2 px-3 py-2', accent.bgLight)}>
        <div
          className={cn(
            'w-7 h-7 rounded-full flex items-center justify-center text-sm',
            accent.bg,
          )}
        >
          {personaIcon}
        </div>
        <span className="text-xs font-bold text-on-surface">{personaName}</span>
        <span
          className={cn(
            'text-[9px] px-1.5 py-0.5 rounded font-medium',
            accent.bg,
            accent.text,
          )}
        >
          {personaTitle}
        </span>
      </div>

      {/* Body */}
      <div className="px-3 py-2">
        {content ? (
          <div className="relative">
            <MarkdownRenderer content={content} />
            {isStreaming && (
              <span className="inline-block w-1.5 h-3 bg-primary/70 animate-pulse rounded-sm ml-0.5 align-text-bottom" />
            )}
          </div>
        ) : (
          <div className={cn('h-12 animate-pulse rounded', accent.bgLight)} />
        )}
      </div>
    </div>
  );
};
