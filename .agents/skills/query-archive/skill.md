---
description: 'Query archive with progressive loading - search index first, load details on demand via SubAgent.'
---

# Skill: query-archive

Search completed feature archives using structured metadata. Uses progressive loading: lightweight index scan first, SubAgent deep-load only for matched features.

## Usage

```
/query-archive                              # List recent archives (last 10)
/query-archive --id <feature-id>            # Get details of a specific archived feature
/query-archive --keyword <term>             # Search by keyword
/query-archive --category <cat>             # Filter by category (backend/frontend/fullstack/infra/docs/refactor)
/query-archive --related <feature-id>       # Find features related to given feature
/query-archive --since <date>               # Archives since date (YYYY-MM-DD)
/query-archive --summary                    # Summary stats of all archives
```

Options can be combined: `--keyword auth --category backend --since 2026-01-01`

## Architecture: Progressive Loading

```
query-archive (main context)
    │
    ├─ Level 1: Read archive-log.yaml (index, ~KB)
    │   → Filter by keywords/category/date/related
    │   → Return quick summary (metadata only)
    │
    └─ Level 2: SubAgent deep-load (if --id or user wants details)
        │  ← Independent 200k context
        │
        ├─ Read features/archive/done-{id}/spec.md
        ├─ Read features/archive/done-{id}/task.md
        ├─ Read features/archive/done-{id}/checklist.md
        ├─ Read features/archive/done-{id}/evidence/ (if exists)
        └─ Return structured summary (KB-scale)
```

## Execution Steps

### Step 1: Read Index

Read `features/archive/archive-log.yaml`. If file doesn't exist: report "No archives found" and **STOP**.

### Step 2: Apply Filters

Filter the `archived` list based on provided options:

| Filter | Match Logic |
|--------|-------------|
| `--keyword <term>` | Case-insensitive match against `keywords[]`, `name`, `id` |
| `--category <cat>` | Exact match against `category` |
| `--related <id>` | Match where `id` is in `related_features[]`, OR `{id}` is in the target's `related_features[]` (bidirectional) |
| `--since <date>` | `completed` >= date |
| `--id <id>` | Exact match on `id` field |
| (no filters) | Return last 10 entries (sorted by `completed` desc) |

### Step 3: Return Level 1 Results (Index Summary)

If no `--id` specified, or multiple results found:

```
Archive query results ({n} matched):

  feat-auth | User Authentication | 2026-03-02
    category: backend | keywords: [auth, login, jwt]
    value_points: 3 | related: [feat-session, feat-rbac]
    verification: passed (8/8 scenarios)

  feat-dashboard | Dashboard UI | 2026-03-05
    category: frontend | keywords: [dashboard, chart, widget]
    value_points: 2 | related: [feat-analytics]
    verification: passed (5/5 scenarios)

Use /query-archive --id <feature-id> for full details.
```

### Step 4: Level 2 Deep Load (only when --id specified)

When `--id <feature-id>` is provided, use **Agent Tool** to spawn a `general-purpose` SubAgent for deep archive analysis:

**SubAgent prompt template:**

```
You are an Archive Analysis Agent. Load and analyze the complete archive for feature {id}.

1. Read these files:
   - features/archive/done-{id}-*/spec.md
   - features/archive/done-{id}-*/task.md
   - features/archive/done-{id}-*/checklist.md
   - features/archive/done-{id}-*/evidence/ (if exists)

2. Return a structured summary:

   ## Feature: {id} — {name}

   ### Requirements
   - Value points: {extract from spec}
   - Acceptance criteria: {list from spec}
   - Dependencies: {from spec}

   ### Implementation
   - Tasks completed: {n}/{total}
   - Key files modified: {list from task.md}
   - Technical approach: {summary from task.md}

   ### Verification
   - Scenarios passed: {n}/{total}
   - Evidence files: {list}

   ### Relationships
   - Related features: {list with brief descriptions}
   - Parent/Children: {if any}

Return ONLY this structured summary. Be concise but complete.
```

### Step 5: Return Deep Load Results

Present the SubAgent's structured summary to the user. If SubAgent fails: fall back to Level 1 summary with note "Full archive analysis unavailable, showing index data only."

## Batch Deep Load

When multiple features need deep analysis (e.g., `--related` returning several results), process them in a single SubAgent:

```
You are an Archive Analysis Agent. Analyze these archived features: {id1}, {id2}, {id3}

For each feature, read its archive directory and provide a concise summary focusing on:
1. What it implemented
2. Key technical decisions
3. How it relates to [{reference_feature_id}]

Return a structured summary for all features.
```

## Summary Mode (`--summary`)

When `--summary` is specified, compute and display aggregate statistics:

```
Archive Summary ({total} features archived)

  By Category:
    backend:    {n} features
    frontend:   {n} features
    fullstack:  {n} features

  By Month:
    2026-03: {n} features
    2026-04: {n} features

  Verification:
    passed:  {n} ({pct}%)
    warning: {n} ({pct}%)
    failed:  {n} ({pct}%)

  Top Keywords:
    auth ({n}), api ({n}), ui ({n}), ...

  Average Duration: {avg}h
  Total Value Points: {n}
```

## Error Handling

| Error | Description | Solution |
|-------|-------------|----------|
| NO_ARCHIVES | archive-log.yaml doesn't exist | No features completed yet |
| NOT_FOUND | Feature ID not in archive | Check ID, use /list-features |
| ARCHIVE_DIR_MISSING | done-{id}/ directory missing | Recover from git tag |
| SUBAGENT_FAILED | SubAgent deep-load failed | Fall back to index summary |

## Notes

1. Level 1 (index scan) is always fast — archive-log.yaml is structured YAML with rich metadata
2. Level 2 (deep load) only fires when specific detail is needed — keeps main context clean
3. All archive files are preserved — progressive loading is purely an access pattern
4. Archive recovery: if physical files are missing, use `git show {tag_name}:path` to recover
