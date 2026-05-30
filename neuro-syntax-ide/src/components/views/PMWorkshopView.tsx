import React, { useState } from 'react';
import { cn } from '../../lib/utils';
import type { PMWorkshopTab, BMADSessionState, BrainstormOutput, PartyInsight, PartyReport, PRDDocument } from '../../types';
import { BrainstormPanel } from '../pm-workshop/BrainstormPanel';
import { PartyModePanel } from '../pm-workshop/PartyModePanel';
import { PrdCreationPanel } from '../pm-workshop/PrdCreationPanel';

interface PMWorkshopViewProps {
  workspacePath: string;
}

const WORKSHOP_TABS: { id: PMWorkshopTab; label: string }[] = [
  { id: 'brainstorm', label: 'Brainstorm' },
  { id: 'party-mode', label: 'Party Mode' },
  { id: 'prd', label: 'Create PRD' },
];

export const PMWorkshopView: React.FC<PMWorkshopViewProps> = ({ workspacePath }) => {
  const [activeTab, setActiveTab] = useState<PMWorkshopTab>('brainstorm');
  const [sessionState, setSessionState] = useState<BMADSessionState>({});

  return (
    <div className="flex flex-col h-full w-full bg-app text-on-surface">
      {/* Header */}
      <div className="h-14 bg-surface-container-low flex items-center justify-between px-6 border-b border-outline-variant/10 shrink-0">
        <h1 className="text-xl font-headline font-bold">PM Workshop</h1>
        <div className="flex items-center gap-2">
          {sessionState.brainstormOutput && (
            <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-secondary/20 text-secondary">
              Brainstorm
            </span>
          )}
          {sessionState.partyInsights && sessionState.partyInsights.length > 0 && (
            <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-tertiary/20 text-tertiary">
              Party Mode
            </span>
          )}
          {sessionState.partyReport && (
            <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-400/20 text-emerald-400">
              Report
            </span>
          )}
          {sessionState.prdDocument && (
            <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-primary/20 text-primary">
              PRD
            </span>
          )}
        </div>
      </div>

      {/* Sub-Tab Bar */}
      <div className="flex border-b border-outline-variant/10 shrink-0">
        {WORKSHOP_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "px-4 py-2 text-xs font-bold transition-colors",
              activeTab === tab.id
                ? "text-secondary border-b-2 border-secondary bg-surface-container-lowest"
                : "text-on-surface-variant border-b-2 border-transparent hover:text-on-surface"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Panel Container */}
      <div className="flex-1 overflow-hidden relative">
        <BrainstormPanel
          workspacePath={workspacePath}
          sessionState={sessionState}
          onOutputChange={(output: BrainstormOutput) =>
            setSessionState((prev) => ({ ...prev, brainstormOutput: output }))
          }
          className={activeTab !== 'brainstorm' ? 'hidden' : ''}
        />
        <PartyModePanel
          workspacePath={workspacePath}
          sessionState={sessionState}
          onInsightsChange={(insights: PartyInsight[]) =>
            setSessionState((prev) => ({ ...prev, partyInsights: insights }))
          }
          onReportGenerated={(report: PartyReport) =>
            setSessionState((prev) => ({ ...prev, partyReport: report }))
          }
          onCreatePRD={() => setActiveTab('prd')}
          className={activeTab !== 'party-mode' ? 'hidden' : ''}
        />
        <PrdCreationPanel
          workspacePath={workspacePath}
          sessionState={sessionState}
          onDocumentChange={(doc: PRDDocument) =>
            setSessionState((prev) => ({ ...prev, prdDocument: doc }))
          }
          className={activeTab !== 'prd' ? 'hidden' : ''}
        />
      </div>
    </div>
  );
};
