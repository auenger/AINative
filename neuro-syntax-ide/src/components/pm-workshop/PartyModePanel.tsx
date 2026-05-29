import React from 'react';
import { Users } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { BMADSessionState, PartyInsight } from '../../types';

interface PartyModePanelProps {
  workspacePath: string;
  sessionState: BMADSessionState;
  onInsightsChange: (insights: PartyInsight[]) => void;
}

export const PartyModePanel: React.FC<PartyModePanelProps> = ({
  workspacePath,
  sessionState,
  onInsightsChange,
}) => {
  return (
    <div className="flex flex-col h-full w-full items-center justify-center bg-surface">
      <div className="flex flex-col items-center gap-3 text-on-surface-variant">
        <div className="p-4 rounded-2xl bg-surface-container-high">
          <Users size={32} className="text-tertiary" />
        </div>
        <h2 className="text-sm font-headline font-bold text-on-surface">Party Mode</h2>
        <p className="text-[10px] text-on-surface-variant max-w-xs text-center leading-relaxed">
          Multi-persona roundtable discussion. AI personas with diverse expertise debate
          your product decisions from different angles.
        </p>
        {sessionState.partyInsights && sessionState.partyInsights.length > 0 && (
          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-tertiary/20 text-tertiary">
            {sessionState.partyInsights.length} insights collected
          </span>
        )}
      </div>
    </div>
  );
};
