# Verification Report: feat-chat-style-newtask

**Feature**: Chat-style NewTask Modal (requirement multi-turn conversation + precise new-feature trigger)
**Date**: 2026-04-13
**Status**: PASS

---

## 1. Task Completion Summary

| Task Group | Total Items | Completed | Status |
|------------|-------------|-----------|--------|
| 1. PM Agent System Prompt | 4 | 4 | PASS |
| 2. NewTaskModal Chat Panel UI | 7 | 7 | PASS |
| 3. generateFeaturePlan messages context | 3 | 3 | PASS |
| 4. Two-path UX separation | 3 | 3 | PASS |
| 5. Testing & verification | 4 | 4 | PASS |
| **Total** | **21** | **21** | **PASS** |

## 2. Code Quality Checks

| Check | Result | Details |
|-------|--------|---------|
| TypeScript (`tsc --noEmit`) | PASS | 0 errors in changed files. 2 pre-existing errors in PixelAgentView.tsx and pngLoader.ts (unrelated) |
| New dependencies | PASS | No new dependencies added (reuses useAgentChat, lucide-react icons already imported) |
| Design system | PASS | Uses existing design tokens (bg-primary, text-on-primary, bg-surface-container-high, etc.) |
| React Router | PASS | Not introduced |
| Tauri V2 API | PASS | Uses `@tauri-apps/api` v2 dynamic imports |

## 3. Gherkin Scenario Validation

### Scenario 1: Multi-turn Requirement Clarification
**Status**: PASS

- **Given**: NewTaskModal renders Step 2 with chat panel when `selectedAgent?.isBuiltIn` is true (line 644: `{selectedAgent?.isBuiltIn ? (chat panel) : (textarea)}`)
- **When**: User types in chat input and presses Enter or clicks Send (lines 713-720: `onKeyDown` handler + lines 733-740: Send button `onClick`)
- **Then**: PM_SYSTEM_PROMPT instructs the AI to "ask 1-3 focused questions per turn" and "adapt follow-ups based on answers" (useAgentChat.ts lines 54-62)
- **And**: Chat history scrolls via `chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })` (lines 115-118)
- **And**: Messages are displayed in scrollable list with `overflow-y-auto` and `max-h-[320px]` (line 656)

### Scenario 2: Streaming Output Display
**Status**: PASS

- **Given**: `sendMessage` sets `isStreaming = true` and registers chunk listener (useAgentChat.ts lines 239-262)
- **When**: `agent://chunk` events arrive, `streamingTextRef` accumulates text and updates last assistant message (useAgentChat.ts lines 153-162)
- **Then**: Message bubbles show real-time content via `setMessages` updates (useAgentChat.ts line 158)
- **And**: Streaming indicator shows `animate-pulse` cursor while `isStreaming` is true (lines 692-700)
- **And**: Input textarea is `disabled={isStreaming}` with `opacity-50` class (lines 723, 729)
- **And**: Send button is `disabled={!chatInput.trim() || isStreaming}` (line 741)

### Scenario 3: Conversation Context Passed to Plan Generation
**Status**: PASS

- **Given**: User has exchanged messages via the chat panel
- **When**: User clicks "Create Feature" button, `handleExecute` is called (line 960-981)
- **Then**: For PM Agent path, `generateFeaturePlan(messages)` is called with full `messages` array (line 293)
- **And**: `generateFeaturePlan` filters out the initial greeting and passes the full conversation to `agent_generate_feature_plan` Rust command (useAgentChat.ts lines 295-300)
- **And**: Rust `agent_generate_feature_plan` iterates all messages from request (lib.rs lines 4543-4548)

### Scenario 4: Create Feature Button State
**Status**: PASS

- **Given**: User hasn't sent any messages yet, `messages.filter(m => m.role === 'user').length === 0`
- **Then**: Button is disabled (line 964: `messages.filter(m => m.role === 'user').length === 0 || isStreaming`)
- **When**: User sends at least 1 message, `messages.filter(m => m.role === 'user').length > 0`
- **Then**: Button becomes enabled (line 972: `messages.filter(m => m.role === 'user').length > 0 && !isStreaming`)

### Scenario 5: External Runtime Path Unchanged
**Status**: PASS

- **Given**: User selects Claude Code or Codex (agents with `isBuiltIn: false`)
- **When**: Enters Step 2
- **Then**: Shows textarea with `requirementText` (lines 753-776: `{selectedAgent?.isBuiltIn ? ... : (textarea)}`)
- **And**: `handleExecute` for non-built-in path sends `/new-feature ${requirementText.trim()}` via `runtime_execute` (lines 380-387)
- **And**: No chat panel elements are rendered for external runtime

### Scenario 6: Chat History & Modal State Management
**Status**: PASS

- **Given**: User is chatting in the chat panel
- **When**: User closes the modal via `handleClose` (line 396-415)
- **Then**: `clearChat()` resets messages to initial greeting (useAgentChat.ts `clearChat` callback)
- **And**: `setStep('select-agent')` returns to Step 1 (line 398)
- **And**: All state is reset: `setChatInput('')`, `setRequirementText('')`, `setFeatureCreated(false)`, `setCreatedFeatureId(null)`, `setStreamingOutput('')`, `setPreviewContent('')` (lines 400-407)

## 4. UI/Interaction Checkpoints

| Checkpoint | Status | Evidence |
|------------|--------|----------|
| Chat bubble styles differentiate user/assistant | PASS | user: `bg-primary text-on-primary` (line 673-674), assistant: `bg-surface-container-highest text-on-surface-variant` (line 675) |
| Streaming typing effect | PASS | `animate-pulse` cursor indicator (line 698) |
| Auto-scroll to bottom | PASS | `chatEndRef` + `scrollIntoView({ behavior: 'smooth' })` (lines 112, 115-118, 702) |
| Enter to send, Shift+Enter for newline | PASS | `onKeyDown` handler checks `e.key === 'Enter' && !e.shiftKey` (lines 713-720) |
| Modal drag/resize unaffected | PASS | Drag state and resize CSS preserved unchanged |

## 5. General Checklist

| Item | Status |
|------|--------|
| No new dependencies | PASS |
| Design system unchanged | PASS |
| No React Router | PASS |
| Tauri V2 API syntax | PASS |

## 6. Files Changed

| File | Change |
|------|--------|
| `neuro-syntax-ide/src/lib/useAgentChat.ts` | Updated PM_SYSTEM_PROMPT with multi-turn strategy; changed `generateFeaturePlan` signature from `(description: string)` to `(chatMessages: ChatMessage[])` |
| `neuro-syntax-ide/src/components/views/NewTaskModal.tsx` | Added Send/MessageSquare icons; added chat panel UI for PM Agent path with message bubbles, streaming indicator, auto-scroll, chat input; two-path UX separation; updated handleExecute to pass messages; updated handleClose to clearChat; updated Create Feature button disabled logic |

## 7. Issues

No issues found. All scenarios validated via code analysis.

---

**Verification completed at**: 2026-04-13T16:30:00Z
**Overall Result**: PASS
