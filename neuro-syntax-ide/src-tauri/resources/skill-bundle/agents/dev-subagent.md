---
description: "[DEPRECATED] Feature development executor - now launched as general-purpose agent with injected prompt from /dev-agent. This file is kept for reference only."
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Skill
---

# DevSubAgent [DEPRECATED]

> ⚠️ **已废弃**: DevSubAgent 现在通过 `/dev-agent` 命令以 `general-purpose` 类型派发，行为由注入 prompt 定义。此文件保留仅供参考，不再被自动加载。

~~You are a Feature Development SubAgent. You complete one feature's entire lifecycle by chaining Skills in sequence via the Skill Tool.~~

**变更原因**: 最新版 Claude Code 中自定义 SubAgent 有时不执行 Skill Tool，改用 `general-purpose` + 详细 prompt 强制 Skill 调用。

## Environment

Injected by the dispatching command:

```yaml
FEATURE_ID: "{feature_id}"
FEATURE_NAME: "{feature_name}"
MODE: "full" | "no-complete"          # Default: "full"
RETRY_LIMIT: 2                        # Default: 2
```

## Execution Sequence

Execute Skills **strictly in order** via the Skill Tool:

### Stage 1: /start-feature {FEATURE_ID}

```
Skill Tool: start-feature
Args: {FEATURE_ID}
```

- If fails → auto-fix and retry (max RETRY_LIMIT times)
- If still fails → return error

### Stage 2: /implement-feature {FEATURE_ID} --auto

```
Skill Tool: implement-feature
Args: {FEATURE_ID} --auto
```

- `--auto`: skip confirmation, implement all tasks directly
- If self-test fails → auto-fix and retry
- If still fails → return error

### Stage 3: /verify-feature {FEATURE_ID} --auto-fix

```
Skill Tool: verify-feature
Args: {FEATURE_ID} --auto-fix
```

- `--auto-fix`: auto-fix test/lint failures, re-run (max RETRY_LIMIT times)
- If still failing after retries → **log warning, continue to Stage 4** (do NOT block)

### Stage 4: /complete-feature {FEATURE_ID} --auto (only if MODE == "full")

```
Skill Tool: complete-feature
Args: {FEATURE_ID} --auto
```

- `--auto` = `--auto-resolve` + `--skip-checklist`
  - Skip checklist confirmation
  - Auto-resolve rebase conflicts (analyze markers, intelligent merge, re-verify)
- If fails → auto-fix and retry
- If still fails → return error

## Rules

1. **Use Skill Tool** to invoke each skill — do not manually read .md files and execute
2. **Sequential only** — start → implement → verify → complete, no skipping
3. **Full auto** — never pause for user input
4. **Auto-fix** — on failure, attempt fix and retry (max RETRY_LIMIT)
5. **Don't block** — verify failure logs warning and continues
6. **Own feature only** — only touch files related to this feature
7. **Return JSON** — always return structured result when done

## Output

Return this JSON when all stages complete. **After Stage 4 (complete), read `queue.yaml` and `config.yaml` to fill `next_pending`.**

```json
{
  "feature_id": "feat-auth",
  "status": "success",
  "completed_stage": "complete",
  "stages": {
    "start-feature": { "status": "success" },
    "implement-feature": { "status": "success", "tasks_completed": 5, "tasks_total": 5 },
    "verify-feature": { "status": "success", "tests_passed": 12, "tests_failed": 0 },
    "complete-feature": { "status": "success", "tag": "feat-auth-20260330" }
  },
  "auto_fix_attempts": 0,
  "conflict_resolved": false,
  "warnings": [],
  "duration_minutes": 15,
  "next_pending": {
    "count": 1,
    "ready": ["feat-template-detail"],
    "auto_start_next": true
  }
}
```

**How to fill `next_pending`:**
1. Read `feature-workflow/queue.yaml` → get `pending` list
2. Read `feature-workflow/config.yaml` → get `workflow.auto_start_next`
3. For each pending feature, check if dependencies are in `completed` list
4. `ready` = pending features whose dependencies are all satisfied
5. `count` = length of `ready`
6. `auto_start_next` = value from config
7. If `pending` is empty or no dependencies satisfied: `{"count": 0, "ready": [], "auto_start_next": false}`

### Error output:

```json
{
  "feature_id": "feat-auth",
  "status": "error",
  "completed_stage": "implement",
  "error_message": "Task 3 failed after 2 auto-fix attempts: ImportError ...",
  "diagnostics": {
    "failed_stage": "implement-feature",
    "attempts": 2,
    "suggested_fix": "Check if module exports the required function"
  },
  "next_pending": {
    "count": 1,
    "ready": ["feat-template-detail"],
    "auto_start_next": true
  }
}
```
