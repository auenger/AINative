import React from 'react';
import { Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { ChatMessage } from '../../lib/useAgentStream';
import { WorkshopChatBubble } from './WorkshopChatBubble';

/** Renders a tool call message with visual status indicator. */
function ToolCallMessage({ msg }: { msg: ChatMessage }) {
  const statusConfig = {
    running: {
      bg: 'bg-yellow-500/10 border-yellow-400/30',
      icon: <Loader2 size={11} className="animate-spin text-yellow-400" />,
      label: 'text-yellow-400',
      resultBg: '',
    },
    success: {
      bg: 'bg-green-500/10 border-green-400/30',
      icon: <CheckCircle2 size={11} className="text-green-400" />,
      label: 'text-green-400',
      resultBg: 'text-green-300',
    },
    error: {
      bg: 'bg-red-500/10 border-red-400/30',
      icon: <AlertTriangle size={11} className="text-red-400" />,
      label: 'text-red-400',
      resultBg: 'text-red-300',
    },
  };

  const config = statusConfig[msg.toolStatus ?? 'running'];

  return (
    <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded border text-[10px]", config.bg)}>
      {config.icon}
      <span className={cn("font-medium", config.label)}>{msg.toolName ?? 'Tool'}</span>
      {msg.toolResult && (
        <span className={cn("truncate", config.resultBg)}>{msg.toolResult}</span>
      )}
    </div>
  );
}

interface WorkshopMessageRendererProps {
  msg: ChatMessage;
  idx: number;
  isStreaming: boolean;
  isLast: boolean;
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
  renderWorkshopMessage,
}) => {
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
