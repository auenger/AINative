import React from 'react';
import { cn } from '../../lib/utils';

interface EnergyCheckpointMessageProps {
  message: string;
  exchangeCount: number;
  ideaCount: number;
  onAction: (action: string) => void;
  disabled?: boolean;
}

export const EnergyCheckpointMessage: React.FC<EnergyCheckpointMessageProps> = ({
  message,
  exchangeCount,
  ideaCount,
  onAction,
  disabled = false,
}) => {
  return (
    <div className={cn(
      'bg-yellow-500/5 border border-yellow-500/20 rounded-lg p-3 max-w-[85%]'
    )}>
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-sm">⚡</span>
        <span className="text-[10px] text-yellow-500 font-bold">Energy Checkpoint</span>
        <span className="text-[9px] text-on-surface-variant ml-auto">
          {ideaCount} ideas / {exchangeCount} exchanges
        </span>
      </div>
      <p className="text-[10px] text-on-surface-variant mb-2">{message}</p>
      <div className="flex gap-1.5 flex-wrap">
        {[
          { id: 'continue', label: 'Continue Exploring' },
          { id: 'switch', label: 'Switch Technique' },
          { id: 'deepen', label: 'Deep Dive' },
          { id: 'organize', label: 'Start Organizing' },
        ].map((action) => (
          <button
            key={action.id}
            onClick={() => onAction(action.id)}
            disabled={disabled}
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
    </div>
  );
};
