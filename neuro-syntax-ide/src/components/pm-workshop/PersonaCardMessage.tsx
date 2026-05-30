import React, { useMemo } from 'react';
import { FileText, Pencil, Terminal, Search, Cpu, FolderSearch, Wrench } from 'lucide-react';
import { cn } from '../../lib/utils';
import { parseContentSegments, type ContentSegment, type ToolCallInfo } from '../../lib/utils';
import { MarkdownRenderer } from '../common/MarkdownRenderer';
import { ACCENT_CLASS_MAP } from '../../lib/bmad/persona-definitions';

// ─── Types ───

export interface PersonaCardMessageProps {
  personaId: string;
  personaName: string;
  personaTitle: string;
  personaIcon: string;
  accentColor: string;
  content: string;
  isStreaming?: boolean;
  isLoading?: boolean;
}

// ─── Tool Call Chip ───

const TOOL_ICONS: Record<string, React.ReactNode> = {
  Read: <FileText size={10} className="shrink-0" />,
  Write: <Pencil size={10} className="shrink-0" />,
  Edit: <Pencil size={10} className="shrink-0" />,
  Bash: <Terminal size={10} className="shrink-0" />,
  Grep: <Search size={10} className="shrink-0" />,
  Agent: <Cpu size={10} className="shrink-0" />,
  Glob: <FolderSearch size={10} className="shrink-0" />,
};

function ToolCallChip({ toolName, param }: ToolCallInfo) {
  const icon = TOOL_ICONS[toolName] || <Wrench size={10} className="shrink-0" />;
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-surface-container/40 border border-outline-variant/10 my-0.5">
      <span className="text-on-surface-variant">{icon}</span>
      <span className="text-[9px] font-semibold text-on-surface">{toolName}</span>
      {param && (
        <span className="text-[9px] text-on-surface-variant truncate max-w-[300px]" title={param}>
          {param}
        </span>
      )}
    </div>
  );
}

// ─── Component ───

export const PersonaCardMessage: React.FC<PersonaCardMessageProps> = ({
  personaId,
  personaName,
  personaTitle,
  personaIcon,
  accentColor,
  content,
  isStreaming = false,
  isLoading = false,
}) => {
  const accent = ACCENT_CLASS_MAP[accentColor] ?? ACCENT_CLASS_MAP['blue'];

  const segments: ContentSegment[] = useMemo(
    () => (content ? parseContentSegments(content) : []),
    [content],
  );

  if (isLoading) {
    return (
      <div
        className={cn(
          'bg-surface-container-low rounded-lg overflow-hidden max-w-[85%] border-l-3',
          accent.border,
        )}
        data-persona={personaId}
      >
        <div className={cn('flex items-center gap-2 px-3 py-2', accent.bgLight)}>
          <div
            className={cn(
              'w-7 h-7 rounded-full flex items-center justify-center text-sm',
              accent.bg,
            )}
          >
            {personaIcon}
          </div>
          <span className="text-xs font-bold text-on-surface">{personaName}</span>
          <span
            className={cn(
              'text-[9px] px-1.5 py-0.5 rounded font-medium',
              accent.bg,
              accent.text,
            )}
          >
            {personaTitle}
          </span>
        </div>
        <div className={cn('h-16 animate-pulse', accent.bgLight)} />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'bg-surface-container-low rounded-lg overflow-hidden max-w-[85%] border-l-3',
        accent.border,
      )}
      data-persona={personaId}
    >
      {/* Header */}
      <div className={cn('flex items-center gap-2 px-3 py-2', accent.bgLight)}>
        <div
          className={cn(
            'w-7 h-7 rounded-full flex items-center justify-center text-sm',
            accent.bg,
          )}
        >
          {personaIcon}
        </div>
        <span className="text-xs font-bold text-on-surface">{personaName}</span>
        <span
          className={cn(
            'text-[9px] px-1.5 py-0.5 rounded font-medium',
            accent.bg,
            accent.text,
          )}
        >
          {personaTitle}
        </span>
      </div>

      {/* Body */}
      <div className="px-3 py-2">
        {content ? (
          <div className="relative">
            {segments.length === 1 && segments[0].type === 'text' ? (
              <MarkdownRenderer content={segments[0].content} />
            ) : (
              <div className="space-y-1">
                {segments.map((seg, i) =>
                  seg.type === 'tool-call' && seg.toolInfo ? (
                    <ToolCallChip key={i} toolName={seg.toolInfo.toolName} param={seg.toolInfo.param} />
                  ) : seg.content ? (
                    <MarkdownRenderer key={i} content={seg.content} />
                  ) : null,
                )}
              </div>
            )}
            {isStreaming && (
              <span className="inline-block w-1.5 h-3 bg-primary/70 animate-pulse rounded-sm ml-0.5 align-text-bottom" />
            )}
          </div>
        ) : (
          <div className={cn('h-12 animate-pulse rounded', accent.bgLight)} />
        )}
      </div>
    </div>
  );
};
