import React from 'react';
import { CheckCircle2, Circle } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { BrainstormStep } from '../../types';

const STEPS: { id: BrainstormStep; label: string }[] = [
  { id: 'setup', label: 'Setup' },
  { id: 'technique', label: 'Technique' },
  { id: 'execute', label: 'Execute' },
  { id: 'organize', label: 'Organize' },
];

interface ProgressStepperProps {
  currentStep: BrainstormStep;
  completedSteps: BrainstormStep[];
}

export const ProgressStepper: React.FC<ProgressStepperProps> = ({
  currentStep,
  completedSteps,
}) => {
  const currentIdx = STEPS.findIndex((s) => s.id === currentStep);

  return (
    <div className="flex items-center gap-0 px-4 py-3 bg-surface-container-lowest border-b border-outline-variant/10">
      {STEPS.map((step, idx) => {
        const isCompleted = completedSteps.includes(step.id);
        const isCurrent = step.id === currentStep;
        const isPending = !isCompleted && !isCurrent;
        const connectorCompleted = idx < currentIdx;

        return (
          <React.Fragment key={step.id}>
            {idx > 0 && (
              <div
                className={cn(
                  'h-0.5 flex-1 mx-2',
                  connectorCompleted ? 'bg-primary' : 'bg-outline-variant/20'
                )}
              />
            )}
            <div className="flex items-center gap-1.5 shrink-0">
              {isCompleted ? (
                <CheckCircle2 size={14} className="text-tertiary" />
              ) : isCurrent ? (
                <Circle size={14} className="text-primary fill-primary" />
              ) : (
                <Circle size={14} className="text-on-surface-variant opacity-50" />
              )}
              <span
                className={cn(
                  'text-[10px] whitespace-nowrap',
                  isCompleted && 'text-tertiary',
                  isCurrent && 'text-primary font-bold',
                  isPending && 'text-on-surface-variant opacity-50'
                )}
              >
                {step.label}
              </span>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
};
