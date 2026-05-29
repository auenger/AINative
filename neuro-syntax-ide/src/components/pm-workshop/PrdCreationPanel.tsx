import React from 'react';
import { FileText } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { BMADSessionState, PRDDocument } from '../../types';

interface PrdCreationPanelProps {
  workspacePath: string;
  sessionState: BMADSessionState;
  onDocumentChange: (doc: PRDDocument) => void;
}

export const PrdCreationPanel: React.FC<PrdCreationPanelProps> = ({
  workspacePath,
  sessionState,
  onDocumentChange,
}) => {
  return (
    <div className="flex flex-col h-full w-full items-center justify-center bg-surface">
      <div className="flex flex-col items-center gap-3 text-on-surface-variant">
        <div className="p-4 rounded-2xl bg-surface-container-high">
          <FileText size={32} className="text-primary" />
        </div>
        <h2 className="text-sm font-headline font-bold text-on-surface">Create PRD</h2>
        <p className="text-[10px] text-on-surface-variant max-w-xs text-center leading-relaxed">
          AI-guided PRD creation with coaching mode. Import brainstorm ideas and party mode
          insights to build comprehensive product requirements.
        </p>
        {sessionState.prdDocument && (
          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-primary/20 text-primary">
            {sessionState.prdDocument.sections.filter((s) => s.status === 'complete').length}/
            {sessionState.prdDocument.sections.length} sections
          </span>
        )}
        {!sessionState.brainstormOutput && !sessionState.partyInsights?.length && (
          <p className="text-[9px] text-on-surface-variant/60 italic">
            Complete Brainstorm or Party Mode first to feed outputs here
          </p>
        )}
      </div>
    </div>
  );
};
