---
description: 'List all features with their current status - active, pending, blocked, and archived.'
---

# Skill: list-features

List all features with their current status.

## Usage

```
/list-features              # Quick status summary
/list-features --verbose    # Detailed view with dependencies
/list-features --json       # Machine-readable output
```

## Execution Steps

### Step 1: Read Configuration

Read `feature-workflow/config.yaml`: max_concurrent, workflow.auto_start, workflow.require_checklist.

### Step 2: Read Queue

Read `feature-workflow/queue.yaml`: active features, pending features, blocked features. Check for parent/children relationships.

### Step 3: Read Archive Log

Read `features/archive/archive-log.yaml`: count archived features.

### Step 4: Calculate Duration

For active features: calculate time since started, format as human-readable (e.g., "2h ago").

### Step 5: Format Output

```
Feature Status
--------------
Active (1/2):
  * feat-auth       [90]  started: 2h ago
    Branch: feature/auth
    Worktree: ../OA_Tool-feat-auth

Pending:
  o feat-dashboard  [80]  created: 1d ago
  o feat-report     [70]  created: 3h ago

Blocked:
  x feat-export     reason: depends on feat-auth

Archived: 2
```

### Enhanced Display (--verbose)

Show size, parent, children, dependencies for each feature. Group split features together.

### JSON Output (--json)

```json
{
  "active": [{ "id", "name", "priority", "branch", "worktree", "started", "duration" }],
  "pending": [{ "id", "name", "priority", "size", "created" }],
  "blocked": [{ "id", "name", "reason", "created" }],
  "archived_count": 2,
  "capacity": { "used": 1, "max": 2 }
}
```

## Error Handling

| Error | Description | Solution |
|-------|-------------|----------|
| CONFIG_NOT_FOUND | config.yaml missing | Check feature-workflow directory |
| QUEUE_NOT_FOUND | queue.yaml missing | Check feature-workflow directory |
| PARSE_ERROR | YAML parsing failed | Check file format |
