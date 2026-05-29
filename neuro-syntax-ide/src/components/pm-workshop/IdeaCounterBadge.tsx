import React from 'react';
import { Lightbulb } from 'lucide-react';
import { cn } from '../../lib/utils';

interface IdeaCounterBadgeProps {
  count: number;
  target?: number;
}

export const IdeaCounterBadge: React.FC<IdeaCounterBadgeProps> = ({
  count,
  target = 100,
}) => {
  return (
    <div className={cn(
      'flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold',
      count >= target ? 'bg-secondary/20 text-secondary' : 'bg-primary/10 text-primary'
    )}>
      <Lightbulb size={12} />
      <span>{count} ideas</span>
      <span className="opacity-60">(target: {target}+)</span>
    </div>
  );
};
