import React, { useMemo } from 'react';
import { CheckCircle2, Loader2, Circle, FileText } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { PRDSection, Assumption } from '../../types';
import { MarkdownRenderer } from '../common/MarkdownRenderer';
import { renderContentWithAssumptions } from './AssumptionTag';

interface PRDDocumentPreviewProps {
  title: string;
  sections: PRDSection[];
  assumptions: Assumption[];
  onConfirmAssumption: (id: string) => void;
  onEditAssumption: (id: string, newText: string) => void;
  activeSectionId?: string;
  onSectionClick?: (sectionId: string) => void;
}

// ─── Outline Section Item ───

interface OutlineItemProps {
  section: PRDSection;
  isActive: boolean;
  assumptionCount: number;
  onClick: () => void;
}

const OutlineItem: React.FC<OutlineItemProps> = ({
  section,
  isActive,
  assumptionCount,
  onClick,
}) => {
  const iconConfig = {
    complete: { icon: <CheckCircle2 size={10} className="text-tertiary" /> },
    'in-progress': { icon: <Loader2 size={10} className="text-primary animate-spin" /> },
    empty: { icon: <Circle size={10} className="text-outline-variant" /> },
  };

  const statusIcon = iconConfig[section.status] ?? iconConfig.empty;

  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 px-3 py-1.5 text-[10px] cursor-pointer w-full text-left transition-colors',
        isActive
          ? 'bg-surface-container-high/80 text-on-surface'
          : 'text-on-surface-variant hover:bg-surface-container-high/50',
      )}
    >
      {statusIcon.icon}
      <span className="flex-1 truncate">{section.title}</span>
      {assumptionCount > 0 && (
        <span className="text-[8px] bg-warning/10 text-warning px-1 rounded shrink-0">
          {assumptionCount}
        </span>
      )}
    </button>
  );
};

// ─── Main Preview Component ───

export const PRDDocumentPreview: React.FC<PRDDocumentPreviewProps> = ({
  title,
  sections,
  assumptions,
  onConfirmAssumption,
  onEditAssumption,
  activeSectionId,
  onSectionClick,
}) => {
  // Count assumptions per section (by searching content for [ASSUMPTION: ...])
  const assumptionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const section of sections) {
      const matches = section.content.match(/\[ASSUMPTION:\s*[^\]]+\]/g);
      counts[section.id] = matches ? matches.length : 0;
    }
    return counts;
  }, [sections]);

  const totalAssumptions = Object.values(assumptionCounts).reduce((a, b) => a + b, 0);
  const completedSections = sections.filter((s) => s.status === 'complete').length;
  const activeId = activeSectionId ?? sections.find((s) => s.status === 'in-progress')?.id ?? sections[0]?.id;

  return (
    <div className="flex h-full">
      {/* Outline Navigation */}
      <div className="w-[200px] shrink-0 border-r border-outline-variant/10 bg-surface-container-lowest overflow-y-auto">
        <div className="px-3 py-2">
          <span className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant">
            Document Outline
          </span>
        </div>
        {sections.length === 0 ? (
          <div className="px-3 py-4 text-center">
            <FileText size={16} className="text-outline-variant mx-auto mb-1" />
            <p className="text-[9px] text-on-surface-variant/60">No sections yet</p>
          </div>
        ) : (
          sections.map((section) => (
            <OutlineItem
              key={section.id}
              section={section}
              isActive={section.id === activeId}
              assumptionCount={assumptionCounts[section.id] ?? 0}
              onClick={() => onSectionClick?.(section.id)}
            />
          ))
        )}
        {totalAssumptions > 0 && (
          <div className="px-3 py-2 border-t border-outline-variant/10">
            <span className="text-[8px] text-warning font-bold">
              {totalAssumptions} assumption{totalAssumptions !== 1 ? 's' : ''} to review
            </span>
          </div>
        )}
        {sections.length > 0 && (
          <div className="px-3 py-2 border-t border-outline-variant/10">
            <span className="text-[8px] text-on-surface-variant">
              {completedSections}/{sections.length} sections complete
            </span>
          </div>
        )}
      </div>

      {/* Document Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {title && (
          <h1 className="text-lg font-headline font-bold text-on-surface mb-4">{title}</h1>
        )}
        {sections.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-on-surface-variant/50">
            <FileText size={32} className="mb-2" />
            <p className="text-[10px]">PRD document will appear here as you build it</p>
          </div>
        ) : (
          sections.map((section) => (
            <div
              key={section.id}
              id={`prd-section-${section.id}`}
              className={cn(
                'mb-6 scroll-mt-4',
                section.id === activeId && 'ring-1 ring-primary/10 rounded-lg p-3 -m-3',
              )}
            >
              {section.content ? (
                <div className="prose-container">
                  {renderContentWithAssumptions(
                    `## ${section.title}\n\n${section.content}`,
                    assumptions,
                    onConfirmAssumption,
                    onEditAssumption,
                  ).map((node, i) => {
                    // Render string nodes via MarkdownRenderer, React nodes directly
                    if (typeof node === 'string') {
                      return <MarkdownRenderer key={i} content={node} />;
                    }
                    return <React.Fragment key={i}>{node}</React.Fragment>;
                  })}
                </div>
              ) : (
                <div className="py-2 px-3 rounded bg-surface-container-low border border-dashed border-outline-variant/20">
                  <span className="text-[10px] text-on-surface-variant/50 italic">
                    {section.title} — pending...
                  </span>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
