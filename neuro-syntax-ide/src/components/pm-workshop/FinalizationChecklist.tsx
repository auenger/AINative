import React from 'react';
import { CheckCircle2, Loader2, Circle, ArrowRight } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface FinalizationStep {
  step: number;
  title: string;
  status: 'complete' | 'in-progress' | 'pending';
  note?: string;
}

interface FinalizationChecklistProps {
  steps: FinalizationStep[];
  allComplete: boolean;
  onCreateFeature: () => void;
}

const STATUS_ICON = {
  complete: <CheckCircle2 size={10} className="text-tertiary" />,
  'in-progress': <Loader2 size={10} className="text-primary animate-spin" />,
  pending: <Circle size={10} className="text-outline-variant" />,
};

export const FinalizationChecklist: React.FC<FinalizationChecklistProps> = ({
  steps,
  allComplete,
  onCreateFeature,
}) => {
  const completedCount = steps.filter((s) => s.status === 'complete').length;

  return (
    <div className="bg-surface-container-low border border-outline-variant/10 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-headline font-bold text-on-surface">PRD Finalization Checklist</span>
        <span className="text-[9px] text-on-surface-variant">
          {completedCount}/{steps.length}
        </span>
      </div>

      <div className="space-y-1">
        {steps.map((step) => (
          <div key={step.step} className="flex items-center gap-2 text-[10px] py-1">
            {STATUS_ICON[step.status]}
            <span
              className={cn(
                'flex-1',
                step.status === 'complete'
                  ? 'text-on-surface-variant line-through'
                  : step.status === 'in-progress'
                    ? 'text-primary font-bold'
                    : 'text-on-surface-variant',
              )}
            >
              {step.step}. {step.title}
            </span>
            {step.note && (
              <span className="text-[8px] text-on-surface-variant/60 italic truncate max-w-[120px]">
                {step.note}
              </span>
            )}
          </div>
        ))}
      </div>

      {allComplete && (
        <button
          onClick={onCreateFeature}
          className="mt-4 w-full flex items-center justify-center gap-2 bg-primary text-on-primary px-4 py-2 rounded-lg text-xs font-bold hover:bg-primary/90 transition-colors"
        >
          Create Feature <ArrowRight size={12} />
        </button>
      )}
    </div>
  );
};
