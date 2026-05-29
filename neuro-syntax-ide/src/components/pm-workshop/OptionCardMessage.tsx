import React, { useState } from 'react';
import { cn } from '../../lib/utils';

export interface OptionItem {
  id: string;
  emoji: string;
  title: string;
  description: string;
}

interface OptionCardMessageProps {
  options: OptionItem[];
  onSelect: (id: string) => void;
  disabled?: boolean;
}

const DEFAULT_EMOJIS: Record<string, string> = {
  browse: '🔍',
  recommend: '🤖',
  random: '🎲',
  progressive: '📈',
};

export const OptionCardMessage: React.FC<OptionCardMessageProps> = ({
  options,
  onSelect,
  disabled = false,
}) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleClick = (id: string) => {
    if (disabled) return;
    setSelectedId(id);
    onSelect(id);
  };

  return (
    <div className="flex flex-col items-start max-w-[85%]">
      <div className="grid grid-cols-2 gap-2 w-full">
        {options.map((opt) => {
          const isSelected = selectedId === opt.id;
          return (
            <button
              key={opt.id}
              onClick={() => handleClick(opt.id)}
              disabled={disabled}
              className={cn(
                'text-left bg-surface-container-low border rounded-lg p-3 transition-all',
                isSelected
                  ? 'border-primary bg-primary/10'
                  : 'border-outline-variant/10 hover:border-primary/30 hover:bg-primary/5',
                disabled && 'opacity-50 cursor-not-allowed'
              )}
            >
              <div className="text-lg mb-1">{opt.emoji || DEFAULT_EMOJIS[opt.id] || '💡'}</div>
              <div className="text-xs font-bold text-on-surface">{opt.title}</div>
              <div className="text-[10px] text-on-surface-variant mt-0.5">{opt.description}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
