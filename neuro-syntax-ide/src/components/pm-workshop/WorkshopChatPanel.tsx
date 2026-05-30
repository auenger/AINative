import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Send, Loader2, GripVertical } from 'lucide-react';
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

  // Resizable split state
  const [splitRatio, setSplitRatio] = useState(0.5);
  const isDraggingRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Drag handlers for resizable split
  const handleDividerDown = useCallback(() => {
    isDraggingRef.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    if (!rightPanel) return;

    const handleMove = (e: MouseEvent) => {
      if (!isDraggingRef.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const ratio = (e.clientX - rect.left) / rect.width;
      setSplitRatio(Math.max(0.2, Math.min(0.8, ratio)));
    };

    const handleUp = () => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };
  }, [rightPanel]);

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
    <div ref={containerRef} className="flex h-full">
      {/* Chat Area */}
      <div
        className={cn("flex flex-col min-w-0", !rightPanel && "flex-1")}
        style={rightPanel ? { width: `${splitRatio * 100}%` } : undefined}
      >
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

      {/* Drag Handle */}
      {rightPanel && (
        <div
          onMouseDown={handleDividerDown}
          className="w-2 shrink-0 cursor-col-resize group relative flex items-center justify-center hover:bg-primary/5 active:bg-primary/10 transition-colors"
        >
          <div className="absolute inset-y-0 -left-1.5 -right-1.5" />
          <div className="w-0.5 h-10 rounded-full bg-outline-variant/20 group-hover:bg-primary/40 group-active:bg-primary/60 transition-colors" />
        </div>
      )}

      {/* Right Panel */}
      {rightPanel && (
        <div
          style={{ width: `${(1 - splitRatio) * 100}%` }}
          className="min-w-0 overflow-hidden"
        >
          {rightPanel}
        </div>
      )}
    </div>
  );
};
