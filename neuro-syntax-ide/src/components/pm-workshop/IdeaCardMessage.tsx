import React from 'react';
import { cn } from '../../lib/utils';
import type { BrainstormIdea } from '../../types';

interface IdeaCardMessageProps {
  idea: BrainstormIdea;
}

export const IdeaCardMessage: React.FC<IdeaCardMessageProps> = ({ idea }) => {
  return (
    <div className={cn(
      'bg-surface-container-low border border-outline-variant/10 rounded-lg p-3 max-w-[85%]'
    )}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant">
          [{idea.category} #{idea.number}]
        </span>
      </div>
      <div className="text-xs font-bold text-on-surface">{idea.title}</div>
      <div className="text-[10px] text-on-surface-variant mt-1">{idea.concept}</div>
      <div className="text-[10px] text-primary/70 italic mt-1">{idea.novelty}</div>
    </div>
  );
};
