import React, { useState } from 'react';
import { cn } from '../../lib/utils';

interface AssumptionTagProps {
  assumptionId: string;
  text: string;
  confirmed: boolean;
  onConfirm: (id: string) => void;
  onEdit: (id: string, newText: string) => void;
}

export const AssumptionTag: React.FC<AssumptionTagProps> = ({
  assumptionId,
  text,
  confirmed,
  onConfirm,
  onEdit,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(text);

  const handleConfirm = () => {
    onConfirm(assumptionId);
    setExpanded(false);
  };

  const handleEditSave = () => {
    onEdit(assumptionId, editText);
    setEditing(false);
    setExpanded(false);
  };

  const handleEditCancel = () => {
    setEditText(text);
    setEditing(false);
  };

  return (
    <span className="relative inline-flex">
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          'text-[9px] font-bold px-1.5 py-0.5 rounded cursor-pointer transition-all inline-flex items-center gap-1 border',
          confirmed
            ? 'bg-tertiary/10 text-tertiary border-tertiary/20 hover:bg-tertiary/20'
            : 'bg-warning/10 text-warning border-warning/20 hover:bg-warning/20',
        )}
      >
        [ASSUMPTION: {text.length > 40 ? text.slice(0, 40) + '...' : text}]
      </button>

      {expanded && (
        <div className="absolute z-50 top-full mt-1 left-0 min-w-[240px] bg-surface-container border border-outline-variant/10 rounded-lg shadow-xl p-3">
          {!editing ? (
            <>
              <p className="text-xs text-on-surface mb-3">{text}</p>
              <div className="flex items-center gap-2">
                {!confirmed && (
                  <button
                    onClick={handleConfirm}
                    className="px-2 py-1 text-[9px] font-bold rounded bg-tertiary/10 text-tertiary hover:bg-tertiary/20 transition-colors"
                  >
                    Confirm
                  </button>
                )}
                <button
                  onClick={() => setEditing(true)}
                  className="px-2 py-1 text-[9px] font-bold rounded bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => setExpanded(false)}
                  className="px-2 py-1 text-[9px] font-bold rounded text-on-surface-variant hover:bg-surface-container-high transition-colors"
                >
                  Close
                </button>
              </div>
            </>
          ) : (
            <>
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                className="w-full bg-surface-container-low border border-outline-variant/20 rounded p-2 text-xs text-on-surface focus:outline-none focus:border-primary/50 resize-none h-16"
              />
              <div className="flex items-center gap-2 mt-2">
                <button
                  onClick={handleEditSave}
                  className="px-2 py-1 text-[9px] font-bold rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                >
                  Save
                </button>
                <button
                  onClick={handleEditCancel}
                  className="px-2 py-1 text-[9px] font-bold rounded text-on-surface-variant hover:bg-surface-container-high transition-colors"
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </span>
  );
};

/**
 * Process PRD content text, replacing [ASSUMPTION: ...] tags with interactive components.
 */
export function renderContentWithAssumptions(
  content: string,
  assumptions: Array<{ id: string; text: string; confirmed: boolean }>,
  onConfirm: (id: string) => void,
  onEdit: (id: string, newText: string) => void,
): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /\[ASSUMPTION:\s*([^\]]+)\]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let assumptionIdx = 0;

  while ((match = regex.exec(content)) !== null) {
    // Add text before the assumption
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index));
    }

    const assumptionText = match[1].trim();
    const assumption = assumptions[assumptionIdx];
    const assumptionId = assumption?.id ?? `asm-${assumptionIdx}`;

    parts.push(
      <AssumptionTag
        key={assumptionId}
        assumptionId={assumptionId}
        text={assumptionText}
        confirmed={assumption?.confirmed ?? false}
        onConfirm={onConfirm}
        onEdit={onEdit}
      />,
    );

    assumptionIdx++;
    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex));
  }

  return parts;
}
