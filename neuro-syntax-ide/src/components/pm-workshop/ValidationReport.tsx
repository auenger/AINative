import React, { useState } from 'react';
import { cn } from '../../lib/utils';
import { ChevronDown, ChevronRight } from 'lucide-react';

// ─── Types ───

export interface ValidationFinding {
  severity: 'high' | 'medium' | 'low';
  title: string;
  location: string;
  suggestion: string;
}

export interface ValidationDimension {
  id: string;
  name: string;
  grade: 'A' | 'B' | 'C' | 'D';
  score: number;
  findings: ValidationFinding[];
}

export interface ValidationReportData {
  dimensions: ValidationDimension[];
  overallScore: number;
  status: string;
}

interface ValidationReportProps {
  report: ValidationReportData;
  onFixSuggestion?: (dimensionId: string, findingIndex: number) => void;
}

// ─── Grade Config ───

const GRADE_CONFIG: Record<string, { label: string; bg: string; text: string; bar: string }> = {
  A: { label: 'Strong', bg: 'bg-tertiary/10', text: 'text-tertiary', bar: 'bg-tertiary' },
  B: { label: 'Adequate', bg: 'bg-primary/10', text: 'text-primary', bar: 'bg-primary' },
  C: { label: 'Weak', bg: 'bg-warning/10', text: 'text-warning', bar: 'bg-warning' },
  D: { label: 'Problem', bg: 'bg-error/10', text: 'text-error', bar: 'bg-error' },
};

const SEVERITY_CONFIG: Record<string, { bg: string; text: string; border: string }> = {
  high: { bg: 'bg-error/10', text: 'text-error', border: 'border-error/30' },
  medium: { bg: 'bg-warning/10', text: 'text-warning', border: 'border-warning/30' },
  low: { bg: 'bg-surface-container-highest', text: 'text-on-surface-variant', border: 'border-outline-variant/10' },
};

// ─── Finding Row ───

const FindingRow: React.FC<{
  finding: ValidationFinding;
  onFix?: () => void;
}> = ({ finding, onFix }) => {
  const sev = SEVERITY_CONFIG[finding.severity] ?? SEVERITY_CONFIG.low;

  return (
    <div className={cn('px-4 py-2 border-l-2', sev.border)}>
      <div className="flex items-center gap-2 mb-1">
        <span className={cn('text-[8px] font-bold px-1.5 py-0.5 rounded', sev.bg, sev.text)}>
          {finding.severity.toUpperCase()}
        </span>
        <span className="text-[10px] font-bold text-on-surface">{finding.title}</span>
      </div>
      <p className="text-[9px] text-on-surface-variant font-mono mb-1">
        Location: {finding.location}
      </p>
      <p className="text-[10px] text-primary/70 italic">
        {finding.suggestion}
      </p>
      {onFix && (
        <button
          onClick={onFix}
          className="mt-1 px-2 py-0.5 text-[8px] font-bold rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
        >
          Apply Fix
        </button>
      )}
    </div>
  );
};

// ─── Dimension Row ───

const DimensionRow: React.FC<{
  dimension: ValidationDimension;
  onFixSuggestion?: (findingIndex: number) => void;
}> = ({ dimension, onFixSuggestion }) => {
  // Default expand for weak/problem grades
  const defaultExpanded = dimension.grade === 'C' || dimension.grade === 'D';
  const [expanded, setExpanded] = useState(defaultExpanded);
  const grade = GRADE_CONFIG[dimension.grade] ?? GRADE_CONFIG.B;

  return (
    <div className="border-b border-outline-variant/10 last:border-b-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-3 px-3 py-2 w-full cursor-pointer hover:bg-surface-container-high/30 transition-colors"
      >
        <span className="text-xs font-bold text-on-surface w-24 text-left shrink-0">
          {dimension.name}
        </span>
        <span className={cn('px-2 py-0.5 rounded text-[9px] font-bold shrink-0', grade.bg, grade.text)}>
          {dimension.grade} {grade.label}
        </span>
        <div className="h-1.5 bg-outline-variant/10 rounded-full flex-1 min-w-[60px]">
          <div
            className={cn('h-full rounded-full transition-all', grade.bar)}
            style={{ width: `${dimension.score}%` }}
          />
        </div>
        <span className="text-[10px] text-on-surface-variant font-mono w-8 text-right shrink-0">
          {dimension.score}%
        </span>
        <span className="text-outline-variant shrink-0">
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </span>
      </button>

      {expanded && dimension.findings.length > 0 && (
        <div className="pb-2">
          {dimension.findings.map((finding, idx) => (
            <FindingRow
              key={idx}
              finding={finding}
              onFix={onFixSuggestion ? () => onFixSuggestion(idx) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Validation Report Component ───

export const ValidationReport: React.FC<ValidationReportProps> = ({
  report,
  onFixSuggestion,
}) => {
  const overallGrade =
    report.overallScore >= 85 ? 'A' :
    report.overallScore >= 70 ? 'B' :
    report.overallScore >= 50 ? 'C' : 'D';
  const overallConfig = GRADE_CONFIG[overallGrade];

  return (
    <div className="bg-surface-container-low border border-outline-variant/10 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant/10 bg-surface-container-lowest">
        <span className="text-xs font-headline font-bold text-on-surface">PRD Quality Report</span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-on-surface-variant">Overall:</span>
          <span className={cn('px-2 py-0.5 rounded text-[10px] font-bold', overallConfig.bg, overallConfig.text)}>
            {report.overallScore}/100
          </span>
        </div>
      </div>

      {/* Dimension Rows */}
      <div>
        {report.dimensions.map((dim) => (
          <DimensionRow
            key={dim.id}
            dimension={dim}
            onFixSuggestion={onFixSuggestion ? (idx) => onFixSuggestion(dim.id, idx) : undefined}
          />
        ))}
      </div>
    </div>
  );
};
