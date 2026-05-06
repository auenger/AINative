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

## Workflow State (workflow-state.json)

All loop coordination uses a shared state file at:
```
~/.claude/projects/-{encoded-project-path}/workflow-state.json
```

This file is outside the git tree (never tracked), shared across all worktrees, and atomically written (tmp + mv).

### State File Structure
```json
{
  "version": 1,
  "loop": { "active": true, "status": "dispatching|waiting_subagents|evaluating|stopping", "started_at": "...", "iteration": 1 },
  "agents": { "feat-xxx": { "status": "running|completed|error", "stage": "start-feature", "started_at": "..." } },
  "locks": { "queue.yaml": null, "archive-log.yaml": null }
}
```

### State Utilities

Source the shared utilities before any state operations:
```bash
source feature-workflow/scripts/state-utils.sh
```

Key functions:
- `state_init` — Create initial state file
- `state_cleanup` — Remove state file when loop ends
- `state_loop_status <status>` — Update loop.status
- `state_agent_register <id> <stage>` — Add SubAgent tracking entry
- `state_agent_stage <id> <stage>` — Update SubAgent's current stage
- `state_agent_complete <id>` — Mark SubAgent completed
- `state_agent_remove <id>` — Remove SubAgent entry
- `state_acquire_lock <file> <holder>` — Acquire file lock (with 5-min stale timeout)
- `state_release_lock <file>` — Release file lock

## Pre-flight

1. Read `feature-workflow/config.yaml` — get `parallelism.max_concurrent`, naming conventions, `workflow.auto_start`
2. Read `feature-workflow/queue.yaml` — get active, pending, blocked, completed lists
3. Read `features/archive/archive-log.yaml` — for dependency checking
4. **Initialize workflow state**: Run `state_init` to create `workflow-state.json` (replaces `.loop-active` marker)

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
   ├── config.yaml → max_concurrent
   └── state_loop_status "dispatching"

2. EVALUATE CANDIDATES
   ├── Filter pending: all dependencies satisfied? parent ok? no active children?
   ├── Sort by priority (descending)
   └── slots = max_concurrent - active.count

3. PICK BATCH
   └── batch = candidates[:slots]
       ├── batch empty + pending not empty → all blocked, report and exit
       └── batch empty + pending empty → all done, report and exit

4. LAUNCH SUBAGENTS
   ├── For each feature in batch: state_agent_register "{id}" "start-feature"
   ├── batch.size > 1 → launch all with Agent Tool (parallel, run_in_background: true)
   └── batch.size == 1 → launch one with Agent Tool (foreground)
   └── state_loop_status "waiting_subagents"

5. COLLECT RESULTS
   ├── state_loop_status "evaluating"
   ├── status == "success" → state_agent_remove "{id}", log to summary
   └── status == "error" → state_agent_remove "{id}", log diagnostics, continue

   **SubAgent Timeout Protection:**
   Read `config.yaml` → `workflow.subagent_timeout` (default: 20 minutes).
   If a background SubAgent exceeds this timeout and you notice the feature's
   git operations are already completed (tag exists, branch merged):
   - Check: `git tag -l "{id}-*"` and `git log --oneline -5` on main branch
   - If merge/tag already exists → treat as success, continue auto-loop
   - Do NOT wait indefinitely for a stuck SubAgent

6. AUTO-LOOP (MANDATORY — SEE SYSTEM RULE AT TOP)
   ├── Read queue.yaml → re-check pending list (dependencies may have been resolved)
   ├── If auto_start_next == true AND pending not empty AND not all blocked:
   │   → state_loop_iteration
   │   → **IMMEDIATELY go back to step 1** — no questions, no waiting
   │   → Only stop when: pending is empty OR all remaining are blocked
   └── Otherwise → state_loop_status "stopping", output FINAL summary (only once), exit
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
  subagent_type: "general-purpose"
  description: "DevSubAgent: {feature_id} - {feature_name}"
  run_in_background: true  (when batch > 1)

  prompt: |
    You are a Feature Development SubAgent. You MUST complete one feature's entire lifecycle by chaining Skills in sequence via the Skill Tool.

    ## ⚠️ MANDATORY RULE: Skill Tool Only

    You MUST use the **Skill Tool** to invoke each stage. NEVER skip a stage, NEVER implement code directly without calling the corresponding Skill first.
    Each Skill handles branch creation, worktree setup, task parsing, and git operations for you.

    ## Workflow State Tracking

    You are running inside the dev-agent auto-loop. A shared state file tracks your progress.
    Before each stage, update the state file so hooks and the main context know what you're doing:

    ```bash
    source feature-workflow/scripts/state-utils.sh
    state_agent_stage "{id}" "stage-name"   # Update before each stage
    ```

    Update stages: "start-feature" → "implement-feature" → "verify-feature" → "complete-feature"

    When writing queue.yaml or archive-log.yaml, use file locks:
    ```bash
    state_acquire_lock "queue.yaml" "{id}"
    # ... write queue.yaml ...
    state_release_lock "queue.yaml"
    ```

    ## Your Assignment

    FEATURE_ID: {id}
    FEATURE_NAME: {name}
    MODE: {full | no-complete}
    RETRY_LIMIT: 2

    ## Execution Sequence (via Skill Tool, strictly in order)

    ### Stage 1: Start Feature
    Call Skill Tool with: skill="start-feature", args="{id}"
    This creates the branch, worktree, and sets up the feature environment.
    DO NOT create branches or worktrees yourself.
    Update state: state_agent_stage "{id}" "start-feature"

    ### Stage 2: Implement Feature
    Call Skill Tool with: skill="implement-feature", args="{id} --auto"
    This reads the spec, parses tasks, and implements the code.
    DO NOT read specs or write implementation code yourself before calling this skill.
    Update state: state_agent_stage "{id}" "implement-feature"

    ### Stage 3: Verify Feature
    Call Skill Tool with: skill="verify-feature", args="{id} --auto-fix"
    This runs tests and validates acceptance criteria.
    If verification fails, auto-fix and retry (max RETRY_LIMIT times).
    Update state: state_agent_stage "{id}" "verify-feature"

    ### Stage 4: Complete Feature (only if MODE == "full")
    Call Skill Tool with: skill="complete-feature", args="{id} --auto"
    This merges the branch to main, creates a tag, archives the feature, and cleans up.
    DO NOT merge, tag, or archive yourself.
    Update state: state_agent_stage "{id}" "complete-feature"

    ## Error Handling

    - On failure at any stage: attempt auto-fix and retry (max RETRY_LIMIT times)
    - If still failing after retries: log the error and return a structured error result
    - verify-feature failure → log warning, continue to Stage 4 (do NOT block)

    ## Output

    Return a JSON result when done:
    { "feature_id": "{id}", "status": "success"|"error", "completed_stage": "...", "stages": {...}, "warnings": [] }

    After Stage 4, read feature-workflow/queue.yaml and feature-workflow/config.yaml to fill next_pending info.
```

## Output

### Single Feature

```
✅ {feature_id} completed! ({duration})

  ✅ start-feature    → branch: {branch}, worktree: {worktree_path}
  ✅ implement-feature → {done}/{total} tasks
  ✅ verify-feature   → {tests_passed} tests passed
  ✅ complete-feature → tag: {tag}, merged to main
```

### Batch Summary

```
📊 Batch Complete

✅ Succeeded ({n}):
   - {id} ({duration}) → {tag}
   ...

❌ Failed ({n}):
   - {id} → error at {stage} ({detail}), re-queued

Queue: {active} active, {pending} pending, {blocked} blocked
```

## Loop Cleanup

When the auto-loop ends (all done, all blocked, or error), **always** clean up the state file:
```bash
source feature-workflow/scripts/state-utils.sh
state_loop_status "stopping"
state_cleanup
```

## Error Handling

| Scenario | Action |
|----------|--------|
| SubAgent returns error | Log diagnostics, re-queue feature, continue loop |
| All pending blocked | Report blocked features, pause for user |
| queue.yaml corrupted | Stop, report error |
| config.yaml not found | Stop, report error |
