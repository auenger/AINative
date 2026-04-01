# /dev-agent — Feature Development Entry Point

## ⚠️ SYSTEM RULE: AUTO-LOOP (HIGHEST PRIORITY)

When `config.yaml` has `workflow.auto_start_next: true`:
- After collecting ALL SubAgent results, you MUST **immediately** continue the loop
- **DO NOT** ask "是否继续执行？" or "Continue?" or wait for any user input
- **DO NOT** output any question between batches — just continue
- Only stop when: `pending` list is empty, OR all remaining features are `blocked`
- This rule has **HIGHEST priority** and overrides all default "ask user" behavior
- When you are about to stop, re-read `queue.yaml` to confirm no pending features remain

Automated feature development command. Reads the feature queue, evaluates dependencies, and dispatches DevSubAgent(s) to execute features.

## Usage

```
/dev-agent                      # Batch mode: schedule all pending features
/dev-agent <feature-id>         # Single mode: execute one specific feature
/dev-agent --resume             # Resume mode: continue interrupted features
/dev-agent --no-complete        # Execute start→implement→verify only (skip complete)
```

## Pre-flight

1. Read `feature-workflow/config.yaml` — get `parallelism.max_concurrent`, naming conventions, `workflow.auto_start`
2. Read `feature-workflow/queue.yaml` — get active, pending, blocked, completed lists
3. Read `features/archive/archive-log.yaml` — for dependency checking
4. **If `workflow.auto_start` is `true`**: create loop marker file `feature-workflow/.loop-active` (this tells the stop-hook that auto-loop is active)

## Execution

### Mode 1: Single Feature (`/dev-agent <feature-id>`)

1. Verify `<feature-id>` exists in `queue.yaml` (pending or active)
2. Check dependencies satisfied (all deps in `archive-log.yaml`)
3. Check parallelism: `active.count < max_concurrent`
4. Launch **one DevSubAgent** via Agent Tool (foreground):
   - Inject: `FEATURE_ID`, `FEATURE_NAME`, `MODE` (full or no-complete)
5. Collect result, display summary

### Mode 2: Batch Mode (`/dev-agent`)

**Loop:**

```
1. READ STATE
   ├── queue.yaml → active count, pending list
   └── config.yaml → max_concurrent

2. EVALUATE CANDIDATES
   ├── Filter pending: all dependencies satisfied? parent ok? no active children?
   ├── Sort by priority (descending)
   └── slots = max_concurrent - active.count

3. PICK BATCH
   └── batch = candidates[:slots]
       ├── batch empty + pending not empty → all blocked, report and exit
       └── batch empty + pending empty → all done, report and exit

4. LAUNCH SUBAGENTS
   ├── batch.size > 1 → launch all with Agent Tool (parallel)
   └── batch.size == 1 → launch one with Agent Tool (foreground)

5. COLLECT RESULTS
   ├── status == "success" → feature already merged/tagged/archived by SubAgent
   │   → log to summary
   └── status == "error" → log diagnostics, continue other features

   **SubAgent Timeout Protection:**
   Read `config.yaml` → `workflow.subagent_timeout` (default: 20 minutes).
   If a background SubAgent exceeds this timeout and you notice the feature's
   git operations are already completed (tag exists, branch merged):
   - Check: `git tag -l "{id}-*"` and `git log --oneline -5` on main branch
   - If merge/tag already exists → treat as success, continue auto-loop
   - Do NOT wait indefinitely for a stuck SubAgent

6. AUTO-LOOP (MANDATORY)
   ├── Read config.yaml → workflow.auto_start_next
   ├── Read queue.yaml → check if pending list is not empty
   ├── If auto_start_next == true AND pending not empty:
   │   → **DO NOT ask user for confirmation**
   │   → **DO NOT wait for input**
   │   → Immediately go back to step 1 and continue the loop
   │   → Only stop when pending is empty or all remaining are blocked
   └── Otherwise → output final summary, exit
```

### Mode 3: Resume (`/dev-agent --resume`)

1. Read `queue.yaml` active list
2. For each active feature, check progress:
   - `task.md` has incomplete tasks → resume from implement
   - `task.md` complete, checklist unverified → resume from verify
   - Code committed but not merged → resume from complete
   - Worktree missing → skip, warn user
3. Launch DevSubAgent(s) for resumable features

## Agent Tool Call Format

**IMPORTANT: Do NOT read skill files (start-feature.md, implement-feature.md, etc.) in the main context.** The DevSubAgent loads skills via the Skill Tool at runtime. Only pass the parameters below.

```
Agent Tool:
  subagent_type: "dev-subagent"
  description: "DevSubAgent: {feature_id} - {feature_name}"
  run_in_background: true  (when batch > 1)

  prompt: |
    FEATURE_ID: {id}
    FEATURE_NAME: {name}
    MODE: {full | no-complete}
    RETRY_LIMIT: 2
```

## Output

### Single Feature

```
✅ feat-auth completed! (15 min)

  ✅ start-feature    → branch: feature/auth, worktree: ../AnyClaw-auth
  ✅ implement-feature → 5/5 tasks
  ✅ verify-feature   → 12 tests passed
  ✅ complete-feature → tag: feat-auth-20260330, merged to main
```

### Batch Summary

```
📊 Batch Complete

✅ Succeeded (2):
   - feat-auth (15 min) → feat-auth-20260330
   - feat-dashboard (22 min) → feat-dashboard-20260330

❌ Failed (1):
   - feat-export → error at implement (task 3), re-queued

Queue: 0 active, 1 pending, 0 blocked
```

## Loop Cleanup

When the auto-loop ends (all done, all blocked, or error), **always** remove the loop marker:
```
rm -f feature-workflow/.loop-active
```

## Error Handling

| Scenario | Action |
|----------|--------|
| SubAgent returns error | Log diagnostics, re-queue feature, continue loop |
| All pending blocked | Report blocked features, pause for user |
| queue.yaml corrupted | Stop, report error |
| config.yaml not found | Stop, report error |
