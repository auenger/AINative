import React from 'react';
import { cn } from '../../lib/utils';

// ─── Types ───

export interface OrchestratorNoteMessageProps {
  /** The orchestrator note content */
  note: string;
}

// ─── Component ───

export const OrchestratorNoteMessage: React.FC<OrchestratorNoteMessageProps> = ({
  note,
}) => {
  if (!note) return null;

  return (
    <div
      className={cn(
        'bg-surface-container-high/50 rounded-lg px-3 py-2 max-w-[85%]',
        'border-t border-outline-variant/10',
      )}
    >
      <div className="flex items-start gap-1.5">
        <span className="text-[10px] shrink-0 mt-0.5">{'\u{1F3BC}'}</span>
        <p className="italic text-on-surface-variant text-[10px] leading-relaxed">
          {note}
        </p>
      </div>
    </div>
  );
};
