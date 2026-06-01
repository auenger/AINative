import React, { useMemo } from 'react';
import { FileText, Pencil, Terminal, Search, Cpu, FolderSearch, Wrench } from 'lucide-react';
import { cn, parseContentSegments, type ContentSegment, type ToolCallInfo } from '../../lib/utils';
import { MarkdownRenderer } from '../common/MarkdownRenderer';
import type { ChatMessage } from '../../lib/useAgentStream';

interface WorkshopChatBubbleProps {
  msg: ChatMessage;
  isStreaming?: boolean;
  isLast?: boolean;
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

// ─── Streaming text: plain text with whitespace preserved ───
function StreamingText({ content }: { content: string }) {
  return <span className="whitespace-pre-wrap break-words">{content}</span>;
}

// ─── Component ───

export const WorkshopChatBubble: React.FC<WorkshopChatBubbleProps> = ({
  msg,
  isStreaming = false,
  isLast = false,
}) => {
  // Use full markdown rendering only when NOT actively streaming this message
  const useFullMarkdown = !(isStreaming && isLast);

  const segments: ContentSegment[] = useMemo(
    () => (msg.role === 'assistant' && msg.content && useFullMarkdown ? parseContentSegments(msg.content) : []),
    [msg.role, msg.content, useFullMarkdown],
  );

  // Command response: monospace font + special background (feat-rig-slash-commands)
  if (msg.isCommand) {
    return (
      <div className="flex flex-col gap-1 max-w-[85%] items-start">
        <div className="p-3 rounded-lg rounded-tl-none bg-surface-container/60 border border-outline-variant/20 text-xs leading-relaxed">
          <pre className="whitespace-pre-wrap font-mono text-[10px] text-on-surface-variant">{msg.content}</pre>
        </div>
      </div>
    );
  }

  // During streaming, show raw text for speed; after done, parse segments for rich rendering
  const isStreamingText = isStreaming && isLast && msg.role === 'assistant';

  return (
    <div
      className={cn(
        "flex flex-col gap-1 max-w-[85%]",
        msg.role === 'user' ? "ml-auto items-end" : "items-start"
      )}
    >
      <div
        className={cn(
          "p-3 rounded-lg text-xs leading-relaxed",
          msg.role === 'user'
            ? "bg-primary text-on-primary rounded-tr-none"
            : "bg-surface-container-high text-on-surface rounded-tl-none border border-outline-variant/10"
        )}
      >
        {msg.role === 'assistant' ? (
          <div className="[&_p]:text-[10px] [&_pre]:text-[10px] [&_code]:text-[10px]">
            {isStreamingText ? (
              <StreamingText content={msg.content || ''} />
            ) : segments.length === 1 && segments[0].type === 'text' ? (
              <MarkdownRenderer key={`final-${segments[0].content.length}`} content={segments[0].content} />
            ) : segments.length > 1 ? (
              <div className="space-y-1">
                {segments.map((seg, i) =>
                  seg.type === 'tool-call' && seg.toolInfo ? (
                    <ToolCallChip key={i} toolName={seg.toolInfo.toolName} param={seg.toolInfo.param} />
                  ) : seg.content ? (
                    <MarkdownRenderer key={`seg-${i}-${seg.content.length}`} content={seg.content} />
                  ) : null,
                )}
              </div>
            ) : msg.content ? (
              <MarkdownRenderer key={`final-${msg.content.length}`} content={msg.content} />
            ) : null}
            {isLast && isStreaming && (
              <span className="inline-block w-1.5 h-3 bg-primary/70 animate-pulse ml-0.5 align-middle" />
            )}
          </div>
        ) : (
          <div className="whitespace-pre-line break-words">{msg.content}</div>
        )}
      </div>
    </div>
  );
};
