import React from 'react';
import { Lightbulb } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { BMADSessionState, BrainstormOutput } from '../../types';

interface BrainstormPanelProps {
  workspacePath: string;
  sessionState: BMADSessionState;
  onOutputChange: (output: BrainstormOutput) => void;
}

export const BrainstormPanel: React.FC<BrainstormPanelProps> = ({
  workspacePath,
  sessionState,
  onOutputChange,
}) => {
  return (
    <div className="flex flex-col h-full w-full items-center justify-center bg-surface">
      <div className="flex flex-col items-center gap-3 text-on-surface-variant">
        <div className="p-4 rounded-2xl bg-surface-container-high">
          <Lightbulb size={32} className="text-secondary" />
        </div>
        <h2 className="text-sm font-headline font-bold text-on-surface">Brainstorm</h2>
        <p className="text-[10px] text-on-surface-variant max-w-xs text-center leading-relaxed">
          AI-powered brainstorming with multiple techniques. Generate, organize, and refine ideas
          to feed into your product workflow.
        </p>
        {sessionState.brainstormOutput && (
          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-secondary/20 text-secondary">
            {sessionState.brainstormOutput.ideas.length} ideas generated
          </span>
        )}
      </div>
    </div>
  );
};
