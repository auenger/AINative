import React from 'react';
import { cn } from '../../lib/utils';

interface ActionMenuMessageProps {
  actions: { id: string; label: string; description: string }[];
  onAction: (id: string) => void;
  disabled?: boolean;
}

export const ActionMenuMessage: React.FC<ActionMenuMessageProps> = ({
  actions,
  onAction,
  disabled = false,
}) => {
  return (
    <div className="flex gap-1.5 flex-wrap max-w-[85%]">
      {actions.map((action) => (
        <button
          key={action.id}
          onClick={() => onAction(action.id)}
          disabled={disabled}
          title={action.description}
          className={cn(
            'px-2 py-1 text-[10px] font-medium rounded-md transition-colors',
            'bg-surface border border-outline-variant/10 text-on-surface-variant',
            'hover:bg-primary/10 hover:text-primary',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        >
          {action.label}
        </button>
      ))}
    </div>
  );
};
