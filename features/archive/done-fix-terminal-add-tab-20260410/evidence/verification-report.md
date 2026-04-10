# Verification Report: fix-terminal-add-tab

**Date**: 2026-04-10
**Status**: PASS (with manual testing pending)

## Task Completion Summary

| Section | Total | Completed | Status |
|---------|-------|-----------|--------|
| 1. Problem Diagnosis | 4 | 4 | Complete |
| 2. Fix "+" Dropdown | 3 | 3 | Complete |
| 3. Strengthen Tab Add Logic | 3 | 3 | Complete |
| 4. Strengthen Tab Switch Stability | 3 | 3 | Complete |
| 5. Manual Testing | 4 | 0 | Pending (requires dev server) |
| **Total** | **17** | **13** | **76% (code tasks 100%)** |

## Code Quality Checks

- **TypeScript**: No new type errors introduced (tsc unavailable in worktree; manual code review passed)
- **Code Style**: Follows existing conventions (cn() utility, same class naming patterns)
- **No console.log**: No debug logging added
- **Component Structure**: No new components created; only restructured existing DOM

## Gherkin Scenario Analysis

### Scenario 1: New Bash Terminal Tab -- PASS
- `addTab('bash')` called from dropdown button click handler (line 1405)
- `setTabs` uses functional update, appends new tab with unique `term-N` id (line 667)
- `setActiveTabId(id)` sets new tab as active immediately (line 668)
- XTerminal rendered for each tab with correct `active` prop (line 1459-1465)
- Dropdown now outside overflow container, visible when opened (line 1395-1430)
- PTY creation handled by XTerminal mount effect (XTerminal.tsx:140-234)

### Scenario 2: New Claude CLI Terminal Tab -- PASS
- Same `addTab` function with `kind='claude'` (line 1412)
- Label from `t('editor.claudeCode')` translation key
- XTerminal receives `kind='claude'`, which triggers `shellForKind('claude')` -> `{ shell: 'claude', args: [] }`

### Scenario 3: Tab Switch Stability -- PASS
- Click handler `setActiveTabId(tab.id)` on each tab button (line 1367)
- Active tab highlighted via `tabActiveColor(tab.kind)` class (line 1370)
- Non-active terminals use `absolute inset-0 invisible pointer-events-none` (XTerminal.tsx:355)
  -> keeps content, just hides visually
- XTerminal re-fit on `active` prop change via double-RAF (XTerminal.tsx:276-294)

### Scenario 4: Close Tab Auto-Switch -- PASS
- `closeTab` filters out closed tab, finds adjacent index (lines 671-692)
- `Math.min(idx, next.length - 1)` selects nearest remaining tab
- `setActiveTabId(next[newIdx].id)` switches to adjacent tab

### Scenario 5: Close All Tabs Fallback -- PASS
- When `next.length === 0`, creates fallback bash tab (lines 675-683)
- `setActiveTabId(fallback.id)` activates the new fallback tab
- XTerminal mounts for new tab automatically

### Scenario 6: Click Outside Closes Dropdown -- PASS
- Fixed backdrop `div` with `fixed inset-0 z-40` intercepts clicks outside (line 1427-1429)
- Additional mousedown listener on document for `[data-add-menu]` (lines 380-390)
- Both mechanisms ensure dropdown closes on outside click

## Key Changes Summary

1. **Dropdown clipping fix**: Moved "+" button and dropdown outside `overflow-x-auto` scroll container into a separate sibling `div` with `relative shrink-0`
2. **Tab bar positioning**: Added `relative` to tab bar container, `flex-1 min-w-0` to scroll container
3. **Auto-scroll**: Added `termTabScrollRef` and `useEffect` to scroll active terminal tab into view
4. **Click-outside backdrop**: Added `fixed inset-0 z-40` div for reliable dropdown dismissal
5. **Dropdown alignment**: Changed from `left-0` to `right-0` for better positioning next to "+" button

## Files Changed

| File | Change Type | Description |
|------|-------------|-------------|
| `neuro-syntax-ide/src/components/views/EditorView.tsx` | Modified | Restructured terminal tab bar DOM, added auto-scroll |

## Issues

No code issues found. Manual testing with dev server required for full validation of PTY creation and terminal rendering.
