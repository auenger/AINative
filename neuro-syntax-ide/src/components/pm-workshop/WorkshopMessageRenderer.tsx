import React from 'react';
import { Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { ChatMessage } from '../../lib/useAgentStream';
import { WorkshopChatBubble } from './WorkshopChatBubble';

/** Renders a tool call message with visual status indicator. */
function ToolCallMessage({ msg }: { msg: ChatMessage }) {
  const statusConfig = {
    running: {
      bg: 'bg-surface-container/50 border-outline-variant/10',
      icon: <Loader2 size={10} className="animate-spin text-on-surface-variant" />,
      label: 'text-on-surface-variant',
    },
    success: {
      bg: 'bg-green-500/5 border-green-400/20',
      icon: <CheckCircle2 size={10} className="text-green-400" />,
      label: 'text-green-400',
    },
    error: {
      bg: 'bg-red-500/5 border-red-400/20',
      icon: <AlertTriangle size={10} className="text-red-400" />,
      label: 'text-red-400',
    },
  };

  const config = statusConfig[msg.toolStatus ?? 'running'];
  const displayName = msg.toolName
    ? msg.toolName.replace(/^(Agent|Glob|Read|Write|Bash|Grep|Edit)$/, (_, t) => t)
    : '';

  return (
    <div className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded border text-[9px]", config.bg)}>
      {config.icon}
      {msg.toolStatus === 'running' ? (
        <span className={cn("italic", config.label)}>Working...</span>
      ) : (
        <>
          <span className={cn("font-medium", config.label)}>{displayName || 'Done'}</span>
        </>
      )}
    </div>
  );
}

/** Thinking indicator shown when agent is processing (INIT noise detected). */
function ThinkingIndicator() {
  return (
    <div className="flex items-center gap-1.5 text-on-surface-variant">
      <Loader2 size={10} className="animate-spin" />
      <span className="text-[9px] italic animate-pulse">Thinking...</span>
    </div>
  );
}

interface WorkshopMessageRendererProps {
  msg: ChatMessage;
  idx: number;
  isStreaming: boolean;
  isLast: boolean;
  agentStatus?: 'thinking' | null;
  renderWorkshopMessage?: (msg: ChatMessage, idx: number) => React.ReactNode | null;
}

/**
 * Routes message rendering by priority:
 * 1. renderWorkshopMessage custom handler
 * 2. ToolCallMessage
 * 3. WorkshopChatBubble (user / assistant)
 */
export const WorkshopMessageRenderer: React.FC<WorkshopMessageRendererProps> = ({
  msg,
  idx,
  isStreaming,
  isLast,
  agentStatus,
  renderWorkshopMessage,
}) => {
  // When agent is in "thinking" state (INIT noise), show Thinking indicator
  // Only for assistant messages — never hide user messages
  if (isLast && isStreaming && agentStatus === 'thinking' && msg.role === 'assistant') {
    return <ThinkingIndicator />;
  }

  // Priority 1: custom workshop rendering
  if (renderWorkshopMessage) {
    const custom = renderWorkshopMessage(msg, idx);
    if (custom !== null && custom !== undefined) return <>{custom}</>;
  }

  // Priority 2: tool call messages
  if (msg.isToolCall) {
    return <ToolCallMessage msg={msg} />;
  }

  // Priority 3: standard chat bubble
  return <WorkshopChatBubble msg={msg} isStreaming={isStreaming} isLast={isLast} />;
};
