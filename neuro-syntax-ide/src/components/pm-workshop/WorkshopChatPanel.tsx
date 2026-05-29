import React, { useRef, useEffect, useState } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { ChatMessage } from '../../lib/useAgentStream';
import { WorkshopMessageRenderer } from './WorkshopMessageRenderer';

interface WorkshopChatPanelProps {
  messages: ChatMessage[];
  isStreaming: boolean;
  onSendMessage: (text: string) => void;
  placeholder: string;
  /** Custom renderer for workshop-specific message types */
  renderWorkshopMessage?: (msg: ChatMessage, idx: number) => React.ReactNode | null;
  /** Optional addons rendered in the input area */
  inputAddons?: React.ReactNode;
  /** Optional right panel rendered alongside the chat */
  rightPanel?: React.ReactNode;
  /** Agent status for UI (e.g. 'thinking' when INIT noise detected) */
  agentStatus?: 'thinking' | null;
}

export const WorkshopChatPanel: React.FC<WorkshopChatPanelProps> = ({
  messages,
  isStreaming,
  onSendMessage,
  placeholder,
  renderWorkshopMessage,
  inputAddons,
  rightPanel,
  agentStatus,
}) => {
  const [input, setInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() || isStreaming) return;
    onSendMessage(input.trim());
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className={cn("flex h-full", rightPanel ? "divide-x divide-outline-variant/10" : "")}>
      {/* Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Message List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 scroll-hide">
          {messages.map((msg, idx) => (
            <WorkshopMessageRenderer
              key={idx}
              msg={msg}
              idx={idx}
              isStreaming={isStreaming}
              isLast={idx === messages.length - 1}
              agentStatus={agentStatus}
              renderWorkshopMessage={renderWorkshopMessage}
            />
          ))}
          <div ref={chatEndRef} />
        </div>

        {/* Input Area */}
        <div className="border-t border-outline-variant/10 bg-surface">
          {inputAddons}
          <div className="p-4">
            <div className="relative flex flex-col gap-1">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                disabled={isStreaming}
                className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg p-3 text-xs text-on-surface focus:outline-none focus:border-primary/50 resize-none h-20 scroll-hide disabled:opacity-50"
              />
              <div className="flex items-center gap-1 px-1">
                <div className="flex-1" />
                <button
                  onClick={handleSend}
                  disabled={isStreaming || !input.trim()}
                  className={cn(
                    "p-1.5 rounded-md transition-colors",
                    isStreaming || !input.trim()
                      ? "text-outline-variant cursor-not-allowed"
                      : "text-primary hover:bg-primary/10"
                  )}
                >
                  {isStreaming ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Send size={14} />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel */}
      {rightPanel && (
        <div className="w-80 shrink-0 overflow-y-auto">
          {rightPanel}
        </div>
      )}
    </div>
  );
};
