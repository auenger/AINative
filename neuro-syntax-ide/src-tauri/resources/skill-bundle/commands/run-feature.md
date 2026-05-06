# /run-feature — 执行单个 Feature（全自动）

全自动执行一个 feature 的完整生命周期，在主上下文中直接通过 Skill Tool 调用 Skills。
全程无人值守：不暂停、不提问、失败自动重试。

**与 `/dev-agent` 的区别:**
- `/dev-agent`: 批量调度，自动循环，后台 SubAgent，需要 workflow-state.json
- `/run-feature`: 单个执行，主上下文直接运行，无状态文件依赖

## Usage

```
/run-feature <feature-id>              # 全自动: start → implement → verify → complete
/run-feature <feature-id> --no-complete # 跳过 complete 阶段
/run-feature <feature-id> --from <stage> # 从指定阶段继续 (implement / verify / complete)
```

## Behavior Rules

- **全程全自动**: 不暂停、不提问、不等待用户输入
- **自动重试**: 失败时自动修复并重试（最多 2 次）
- **不阻塞**: verify 失败记录警告，继续执行 complete
- **致命错误才停**: 只有无法自动恢复的错误才终止并报告

## Pre-flight

1. Read `feature-workflow/config.yaml` — get project config
2. Read `feature-workflow/queue.yaml` — check feature status
3. Verify feature exists:
   - **pending**: check dependencies satisfied, check parallelism (`active.count < max_concurrent`)
   - **active**: verify worktree exists, determine resume point
   - **not found**: report error, suggest `/list-features`, **STOP**
   - **blocked**: report reason, suggest `/unblock-feature`, **STOP**

## Execution

### Full Lifecycle (pending feature)

Execute Skills **strictly in order** via Skill Tool.

**Stage 1: Start Feature**
```
Skill Tool: skill="start-feature", args="{id}"
```

**Stage 2: Implement Feature**
```
Skill Tool: skill="implement-feature", args="{id} --auto"
```

**Stage 3: Verify Feature**
```
Skill Tool: skill="verify-feature", args="{id} --auto-fix"
```
If verification fails: auto-fix and retry (max 2 times). If still failing: log warning, **continue to Stage 4**.

**Stage 4: Complete Feature** (skip if `--no-complete`)
```
Skill Tool: skill="complete-feature", args="{id} --auto"
```

### Resume Mode (`--from <stage>`)

For active features that need to resume from a specific stage:
- `--from implement`: Start from implement-feature (skip start)
- `--from verify`: Start from verify-feature (skip start + implement)
- `--from complete`: Start from complete-feature (skip start + implement + verify)

## File Lock Safety

Skills that write `queue.yaml` or `archive-log.yaml` already use `state_acquire_lock` / `state_release_lock` internally. No additional locking needed.

## Output

After all stages complete:

```
Feature {id} completed!

  start-feature    → branch: feature/{slug}, worktree: ../{worktree}
  implement-feature → {n}/{total} tasks
  verify-feature   → {n} scenarios passed
  complete-feature → tag: {id}-{date}, merged to main

Duration: {duration}
```

If `--no-complete`:
```
Feature {id} ready for completion.

  start-feature    → branch: feature/{slug}
  implement-feature → {n}/{total} tasks
  verify-feature   → {n} scenarios passed

  Next: /complete-feature {id}
```

## Error Handling

| Scenario | Action |
|----------|--------|
| Feature not found | Report error, STOP |
| Dependencies not met | List missing deps, STOP |
| Parallel limit reached | List active features, STOP |
| Stage fails (recoverable) | Auto-fix + retry (max 2), continue |
| Stage fails (after retries) | Log error, continue to next stage |
| verify fails (after retries) | Log warning, continue to complete |
| complete fails | Report error with diagnostics, STOP |
| Worktree missing | Report, STOP |
