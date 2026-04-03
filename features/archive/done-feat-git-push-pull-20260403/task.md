# Tasks: feat-git-push-pull
## Task Breakdown

### 1. Rust Backend — Push & Pull Commands
- [x] Implement `git_push()` Command (with auth callback)
- [x] Implement `git_pull()` Command (fetch + merge, with auth callback)
- [x] Register all new Commands

### 2. Frontend UI — Real Push/Pull
- [x] Replace handleSync mock with real invoke('git_push') / invoke('git_pull')
- [x] Push/Pull button loading state
- [x] Success/failure feedback
- [x] No remote disabled handling

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-03 | Feature created | |
| 2026-04-03 | All tasks implemented | Rust backend: git_push + git_pull with SSH agent / default cred auth. Frontend: separate push/pull handlers, loading states, sync message toast, disabled when no remote. |
