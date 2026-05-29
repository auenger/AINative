import React, { useState } from 'react';
import { cn } from '../../lib/utils';
import { Zap, GraduationCap } from 'lucide-react';

export interface WorkModeOption {
  id: string;
  label: string;
  icon: string;
  description: string;
}

interface WorkModeSelectorProps {
  options: WorkModeOption[];
  onSelect: (id: string) => void;
  disabled?: boolean;
}

const ICON_MAP: Record<string, React.ReactNode> = {
  zap: <Zap size={18} className="text-secondary" />,
  'graduation-cap': <GraduationCap size={18} className="text-tertiary" />,
};

export const WorkModeSelector: React.FC<WorkModeSelectorProps> = ({
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
      <div className="grid grid-cols-2 gap-3 w-full">
        {options.map((opt) => {
          const isSelected = selectedId === opt.id;
          return (
            <button
              key={opt.id}
              onClick={() => handleClick(opt.id)}
              disabled={disabled}
              className={cn(
                'bg-surface-container-low border rounded-lg p-4 cursor-pointer transition-all text-left',
                isSelected
                  ? 'border-primary/30 bg-primary/5'
                  : 'border-outline-variant/10 hover:border-primary/20',
                disabled && 'opacity-50 cursor-not-allowed',
              )}
            >
              <div className="text-lg mb-2">
                {ICON_MAP[opt.icon] ?? <Zap size={18} />}
              </div>
              <div className="text-sm font-bold text-on-surface">{opt.label}</div>
              <div className="text-[10px] text-on-surface-variant mt-1 leading-relaxed">
                {opt.description}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
