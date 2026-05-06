---
description: 'Implement feature code by reading spec, analyzing tasks, and writing code in worktree.'
---

# Skill: implement-feature

Implement the feature by reading specifications, analyzing tasks, and writing code in the worktree.

## Usage

```
/implement-feature <feature-id> [--task=<index>] [--dry-run] [--auto]
```

Parameters:
- `feature-id`: The feature ID (required)
- `--task=<index>`: Implement only a specific task (optional)
- `--dry-run`: Analyze only, don't implement (optional)
- `--auto`: Skip confirmation, auto-proceed (for SubAgent use)

## Pre-flight Checks

- Feature must be in `feature-workflow/queue.yaml` active list
- Worktree must exist

## Execution Steps

### Step 1: Read Feature Documents

Read `features/active-{id}/spec.md`:
- Feature description
- Context analysis (reference code, related docs)
- Acceptance criteria

Read `features/active-{id}/task.md`:
- Task list
- Task status (completed/pending)

### Step 2: Analyze Tasks

Parse the task list and:
- Identify task dependencies
- Determine implementation order
- List reference code/docs needed

Output analysis with pending tasks and suggested order.

### Step 3: Confirm Plan

Display implementation plan and ask for confirmation.

**If `--auto`:** Skip confirmation, proceed directly to Step 4.

**Otherwise:** Options: `y` (start), `n` (cancel), `edit` (modify plan).

### Step 4: Implement Code

Switch to worktree directory and implement each task:

```bash
cd {worktree_path}
```

For each task:
1. Implement the code
2. Update `task.md` status (check the checkbox)
3. Add brief notes about implementation

Implementation guidelines:
- Reference existing code style
- Reuse existing components and utilities
- Follow project directory structure
- Add necessary error handling
- Add necessary type definitions

### Step 5: Self-Test

- Run existing tests if available
- Manually verify core functionality
- Check code quality
- Record test results

### Step 6: Generate Report

Show completed tasks, files changed, test results.

**If `--auto`:** SubAgent will automatically proceed to verify -> complete. No manual next-step prompt.

**Otherwise:** Suggest `/verify-feature {id}` or `/complete-feature {id}`.

## Output

### Analysis Phase
```yaml
status: analyzed
feature:
  id: {id}
  name: {name}
analysis:
  total_tasks: {n}
  completed: {n}
  pending: {n}
  suggested_order: [{indices}]
```

### Implementation Phase
```yaml
status: implemented
feature:
  id: {id}
implementation:
  completed_tasks:
    - index: {n}
      name: {task_name}
      files:
        - {path} (new)
        - {path} (modified)
  files_changed:
    new: {n}
    modified: {n}
testing:
  tests_run: true
  passed: {n}
  failed: {n}
```

## Error Handling

| Error | Description | Solution |
|-------|-------------|----------|
| NOT_ACTIVE | Feature not in active list | Run /start-feature first |
| WORKTREE_NOT_FOUND | Worktree doesn't exist | Run /start-feature first |
| SPEC_PARSE_ERROR | Cannot parse spec.md | Check document format |
| IMPLEMENTATION_FAILED | Implementation failed | Check details, fix manually |

## Notes

1. **No auto-commit** - Code stays in worktree, not committed
2. **Reference existing code** - Prioritize context mentioned in spec
3. **Keep docs in sync** - Update task.md status during implementation
4. **Resume support** - Can interrupt and continue later
