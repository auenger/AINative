import React from 'react';
import { cn } from '../../lib/utils';
import { MarkdownRenderer } from '../common/MarkdownRenderer';
import type { ChatMessage } from '../../lib/useAgentStream';

interface WorkshopChatBubbleProps {
  msg: ChatMessage;
  isStreaming?: boolean;
  isLast?: boolean;
}

export const WorkshopChatBubble: React.FC<WorkshopChatBubbleProps> = ({
  msg,
  isStreaming = false,
  isLast = false,
}) => {
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
            <MarkdownRenderer content={msg.content} />
            {isLast && isStreaming && (
              <span className="inline-block w-1.5 h-3 bg-primary/70 animate-pulse ml-0.5 align-middle" />
            )}
          </div>
        ) : (
          msg.content
        )}
      </div>
    </div>
  );
};
