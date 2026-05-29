import React, { useState } from 'react';
import { cn } from '../../lib/utils';

export interface IntentOption {
  id: string;
  label: string;
  description: string;
}

interface IntentSelectorProps {
  options: IntentOption[];
  onSelect: (id: string) => void;
  disabled?: boolean;
}

export const IntentSelector: React.FC<IntentSelectorProps> = ({
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
      <div className="flex gap-2 flex-wrap">
        {options.map((opt) => {
          const isSelected = selectedId === opt.id;
          return (
            <button
              key={opt.id}
              onClick={() => handleClick(opt.id)}
              disabled={disabled}
              className={cn(
                'px-3 py-1.5 rounded-full border text-[10px] font-bold cursor-pointer transition-all',
                isSelected
                  ? 'bg-primary/10 border-primary/20 text-primary'
                  : 'bg-surface-container-high border-outline-variant/10 text-on-surface-variant hover:bg-surface-container-highest',
                disabled && 'opacity-50 cursor-not-allowed',
              )}
              title={opt.description}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};
