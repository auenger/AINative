---
description: 'List all features with their current status - active, pending, blocked, and archived.'
---

# Skill: list-features

List all features with their current status. Cross-references three data sources for consistency.

## Usage

```
/list-features              # Quick status summary
/list-features --verbose    # Detailed view with dependencies and reconciliation
/list-features --json       # Machine-readable output
/list-features --fix        # Show inconsistencies with fix suggestions
```

## Execution Steps

### Step 1: Read Configuration

Read `feature-workflow/config.yaml`: max_concurrent, workflow.auto_start, workflow.require_checklist, paths.features_dir, paths.archive_dir.

### Step 2: Read Queue (Primary Source)

Read `feature-workflow/queue.yaml` completely:
- `active[]`: id, name, priority, branch, worktree, started, dependencies
- `pending[]`: id, name, priority, size, dependencies, parent
- `blocked[]`: id, name, reason
- `completed[]`: id, name, priority, size, completed_at, archive_path, value_points, parent
- `parents[]`: id, name, status, children

### Step 3: Read Archive Log (Secondary Source)

Read `features/archive/archive-log.yaml` if exists. Extract `records[]` with id, name, archive_path, keywords, category, value_points, related_features.

If file does not exist, note: archive-log missing, fall back to queue.yaml completed only.

### Step 4: Scan Features Directory (Disk Source)

Scan `features/` directory on disk:
- `active-*` directories: extract feature IDs
- `pending-*` directories: extract feature IDs
- `archive/done-*` directories: extract feature IDs

If `features/` directory does not exist, note: features directory missing.

### Step 5: Three-Source Reconciliation

Build a unified view by cross-referencing all three sources:

**Active reconciliation:**
- Queue active entries → verify worktree directory exists on disk
- Disk `active-*` dirs → verify matching queue active entry

**Pending reconciliation:**
- Queue pending entries → verify disk `pending-*` dir exists (may not exist yet if not started)
- Disk `pending-*` dirs → verify matching queue pending entry

**Blocked reconciliation:**
- Queue blocked entries → standard display

**Completed/Archived reconciliation:**
- Queue completed entries → check if `archive_path` exists and if entry exists in archive-log
- Archive-log records → verify matching queue completed entry
- Disk `archive/done-*` dirs → verify matching queue completed or archive-log entry

**Detect and report these inconsistencies:**

| Type | Condition | Severity |
|------|-----------|----------|
| ORPHAN_DIR | Disk directory exists but no queue entry | warn |
| MISSING_DIR | Queue entry exists but no disk directory (for active) | error |
| ARCHIVE_LOG_GAP | Queue completed but not in archive-log | info |
| ARCHIVE_ORPHAN | Archive-log entry not in queue completed | warn |
| DISK_ARCHIVE_ORPHAN | Disk archive dir not in queue or archive-log | warn |
| STALE_ACTIVE | Queue active but worktree dir missing | error |
| GHOST_WORKTREE | Worktree path configured but not in `git worktree list` | warn |

### Step 6: Calculate Statistics

From the reconciled data:
- Capacity: active count / max_concurrent
- Total completed: queue completed count (authoritative)
- Archive log coverage: archive-log records / queue completed count (%)
- Value points: sum from queue completed entries
- Parents status breakdown (completed / active / pending)

### Step 7: Format Output

#### Standard Output

Use actual data from the three sources, render in this format:

```
Feature Status
══════════════
Config: max_concurrent={from config}, auto_start={from config}

Active ({active_count}/{max_concurrent}):
  * {id}   [{priority}]  {size}   started: {duration}
    Branch: {branch}
    Worktree: {worktree_path}
  (none)                                    ← if empty

Pending ({count}):
  o {id}   [{priority}]  {size}   {name}
  ...

Blocked ({count}):
  x {id}   reason: {reason}
  (none)                                    ← if empty

Completed: {queue_completed_count}
  └── Archive log: {archive_log_count} records, coverage {archive_log_pct}%
      ({status note: "synced" or "N gaps" or "missing"})

Parents:
  ✓ {id}   completed   ({N} children)
  ● {id}   active      ({N} children)
  ○ {id}   pending     ({N} children)
```

#### Verbose Output (--verbose)

Same as standard, plus:
- Each feature shows: dependencies, parent (if any), created/started time
- Completed section shows all entries sorted by completed_at desc, with date and value_points count
- Reconciliation section appended at bottom:

```
Reconciliation:
  {severity_icon} {ISSUE_TYPE}: {description}
  ...                                            ← list all detected issues, or "All sources consistent" if none
```

#### Fix Mode (--fix)

Same as verbose, plus after each reconciliation issue, add a `→` suggestion line:

```
  ⚠ ARCHIVE_LOG_GAP ({N} features):
    → Run /complete-feature on each to rebuild, or /cleanup-features --rebuild-archive

  ⚠ FEATURES_DIR_MISSING:
    → Run /init-project to create features/ directory structure

  ⚠ ORPHAN_DIR: {dir_path} has no queue entry:
    → Run /cleanup-features to resolve
```

#### JSON Output (--json)

```json
{
  "config": { "max_concurrent": "<from config>", "auto_start": "<from config>" },
  "active": [{ "id", "name", "priority", "size", "branch", "worktree", "started", "duration" }],
  "pending": [{ "id", "name", "priority", "size", "dependencies", "parent" }],
  "blocked": [{ "id", "name", "reason" }],
  "completed_count": "<queue completed length>",
  "parents": [{ "id", "name", "status", "children_count" }],
  "capacity": { "used": "<active len>", "max": "<from config>" },
  "reconciliation": {
    "archive_log_count": "<archive-log records length>",
    "archive_log_pct": "<coverage %>",
    "disk_feature_dirs": ["<list of dirs found on disk>"],
    "issues": [{ "type", "severity", "affected_ids", "description", "suggestion" }]
  }
}
```

### Step 8: For active features, calculate duration

For each active feature: calculate time since `started`, format as human-readable (e.g., "2h ago").

## Error Handling

| Error | Description | Solution |
|-------|-------------|----------|
| CONFIG_NOT_FOUND | config.yaml missing | Check feature-workflow directory |
| QUEUE_NOT_FOUND | queue.yaml missing | Check feature-workflow directory |
| PARSE_ERROR | YAML parsing failed | Check file format |
| FEATURES_DIR_MISSING | features/ not found | Graceful: report in reconciliation, not an error |
| ARCHIVE_LOG_MISSING | archive-log.yaml not found | Graceful: fall back to queue completed count |

## Key Principles

- **queue.yaml is the primary source of truth** for active/pending/blocked/completed status
- **archive-log.yaml is supplementary** — provides rich metadata for progressive loading, but may be incomplete
- **Disk state is the ground truth** — if a worktree exists on disk, the feature is active regardless of queue state
- Always report reconciliation discrepancies, never silently ignore them
