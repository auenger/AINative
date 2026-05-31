import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { StepProgressPayload } from '../../types';

interface SkillStepProgressProps {
  progress: StepProgressPayload;
}

/**
 * Skill step progress indicator bar.
 * Displayed at the top of WorkshopChatPanel when a Skill is executing
 * multi-step tasks. Shows a progress bar and step label.
 *
 * Visual design: aligns with existing ProgressStepper style —
 * compact height, primary color for in-progress, tertiary (green) for complete.
 */
export const SkillStepProgress: React.FC<SkillStepProgressProps> = ({ progress }) => {
  const { current, total, label } = progress;
  const isComplete = current >= total;
  const percentage = Math.min(100, Math.round((current / total) * 100));

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-surface-container-lowest border-b border-outline-variant/10">
      {/* Progress bar */}
      <div className="flex-1 h-1.5 rounded-full bg-outline-variant/20 overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-300 ease-out',
            isComplete ? 'bg-tertiary' : 'bg-primary',
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Step text */}
      <div className="flex items-center gap-1.5 shrink-0">
        {isComplete ? (
          <>
            <CheckCircle2 size={12} className="text-tertiary" />
            <span className="text-[10px] font-bold text-tertiary">完成</span>
          </>
        ) : (
          <span className="text-[10px] text-on-surface-variant whitespace-nowrap">
            Step {current}/{total} — {label}
          </span>
        )}
      </div>
    </div>
  );
};
