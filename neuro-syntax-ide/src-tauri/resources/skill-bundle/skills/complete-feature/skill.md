---
description: 'Complete a feature - commit, merge to main, create archive tag, cleanup worktree and branch.'
---

# Skill: complete-feature

Complete a feature by committing code, merging to main, creating an archive tag, and cleaning up.

## Usage

```
/complete-feature <feature-id> [options]
```

Options:
- `--message=<msg>`: Custom commit message
- `--skip-checklist`: Skip checklist verification
- `--no-merge`: Commit only, don't merge
- `--keep-branch`: Keep branch after merge
- `--resume`: Continue after resolving rebase conflicts
- `--auto-resolve`: Automatically resolve rebase conflicts (for SubAgent use)
- `--auto`: Shorthand for `--auto-resolve --skip-checklist` (full auto mode for SubAgent)

## Pre-flight Checks

### Check 1: Feature Status
- Feature must be in `feature-workflow/queue.yaml` active list

### Check 2: Worktree Exists
- Verify worktree path exists and is a valid git worktree

### Check 3: Checklist Complete
- Read `features/active-{id}/checklist.md`
- Count unchecked items
- If incomplete and not `--skip-checklist`/`--auto`: warn user

## Execution Steps

### Step 1: Get Feature Info

From `queue.yaml`: name, branch, worktree, started timestamp. Calculate duration.

### Step 2: Check Checklist

**If `--skip-checklist` or `--auto`:** Skip confirmation, proceed with warning logged.

**Otherwise:** `Continue anyway? (y/n)`

### Step 3: Commit Code

```bash
cd {worktree_path}
git add .
git status
git commit -m "feat({id}): {name}"
```

Record commit hash.

### Step 4: Merge to Main

**Step 4.1: Get Config Values** from `feature-workflow/config.yaml`:
```yaml
project:
  main_branch: main
git:
  remote: origin
  merge_strategy: "--no-ff"
  auto_push: false
```

**Step 4.2: Update Main Branch**
```bash
cd {repo_path}
git checkout {main_branch}
git pull {remote} {main_branch} 2>/dev/null || echo "pull skipped (no remote or offline)"
```

**Step 4.3: Rebase Feature Branch**
```bash
git checkout {branch}
git rebase {main_branch}
```

**Step 4.4: Handle Rebase Conflict (if any)**

**Mode A: Auto-Resolve (`--auto-resolve` or `--auto`)**

```
1. DETECT: git diff --name-only --diff-filter=U -> conflicting files

2. ANALYZE: For each conflicting file:
   a. Read the file, identify <<<< ==== >>>> markers
   b. Read spec.md to understand feature intent
   c. Read project-context.md for project conventions
   d. Intelligent merge strategy:
      - Non-overlapping changes -> Keep both
      - Same function modified -> Combine logic, favor completeness
      - Import conflicts -> Merge import lists, remove duplicates
      - Config changes -> Merge, warn on contradictions
   e. Write resolved content, git add <file>

3. CONTINUE: git rebase --continue (repeat Step 2 if more conflicts)

4. RE-VERIFY: Run tests to confirm resolution (max 1 retry)

5. RECORD: Log conflict details for archive
```

**Conflict Resolution Rules:**
```yaml
imports:
  - Merge both lists, remove duplicates, preserve ordering
functions:
  - One side modified: keep modified version
  - Both modified: combine, favor spec-aligned change
config_files:
  - Merge keys; conflicts: keep main's value, log warning
new_files:
  - Both added: merge content; one added: keep addition
deletions:
  - One deleted, other modified: keep modification, log warning
```

**Mode B: Manual Resolve (default)**
```
Conflicts detected. Resolve in worktree:
  1. cd {worktree_path}
  2. Open conflict files, resolve <<<< markers
  3. git add .
  4. git rebase --continue
  5. /verify-feature {id}
  6. /complete-feature {id} --resume
```

**Step 4.5: Fast-Forward Merge**
```bash
git checkout {main_branch}
git merge {branch}  # Fast-forward after rebase
```

**Step 4.6: Push (if configured)**
If `config.yaml` git.auto_push: `git push {remote} {main_branch} 2>/dev/null || echo "push skipped"`

### Step 5: Create Archive Tag

```bash
TAG_NAME="{id}-{date}"
git tag -a "$TAG_NAME" -m "Archive: {name}"
```

If `config.yaml` git.push_tags: `git push origin "$TAG_NAME" 2>/dev/null || echo "tag push skipped"`

### Step 6: Copy Feature Documents to Archive (BEFORE Worktree Cleanup)

```bash
mkdir -p features/archive/done-{id}-{date}
cp features/active-{id}/spec.md features/archive/done-{id}-{date}/
cp features/active-{id}/task.md features/archive/done-{id}-{date}/
cp features/active-{id}/checklist.md features/archive/done-{id}-{date}/
if [ -d "features/active-{id}/evidence" ]; then
  cp -r features/active-{id}/evidence features/archive/done-{id}-{date}/
fi

# Fallback: also check pending-{id}/evidence (may exist if verify wrote to wrong path)
if [ -d "features/pending-{id}/evidence" ] && [ ! -d "features/archive/done-{id}-{date}/evidence" ]; then
  cp -r features/pending-{id}/evidence features/archive/done-{id}-{date}/
fi
```

### Step 7: Cleanup Worktree and Branch

```bash
git worktree remove {worktree_path}
git branch -d {branch}
```

### Step 8: Verify Archive Completeness (Warning Mode)

Check required files exist in archive. If missing: log warning, continue (DO NOT block).
Files recoverable from git tag: `git show {tag_name}:path/to/file`.

### Step 9: Update spec.md

Add merge record with: completed timestamp, merged branch, merge commit hash, archive tag, conflict record (if any), verification evidence, development stats.

### Step 10: Archive Feature

Files already copied to `done-{id}-{date}` in Step 6. Remove the active directory and any stale pending directory:

```bash
rm -rf features/active-{id}

# Also clean up stale pending directory if it exists
# (may contain leftover evidence from verify-feature writing to wrong path)
if [ -d "features/pending-{id}" ]; then
  rm -rf features/pending-{id}
fi
```

Update `features/archive/archive-log.yaml`:
```yaml
archived:
  - id: {id}
    name: {name}
    completed: {timestamp}
    tag: {tag_name}
    merge_commit: {hash}
    merged_to: main
    branch_deleted: true
    branch_name: {branch}
    worktree_deleted: true
    worktree_path: {path}
    conflicts:
      had_conflict: false | true
      conflict_files: []
      resolved_at: {timestamp}
      re_verified: false | true
    verification:
      status: passed | warning | failed
      scenarios_total: {n}
      scenarios_passed: {n}
    stats:
      started: {started}
      duration: {duration}
      commits: {count}
      files_changed: {count}
```

### Step 11: Update Queue

Remove from `queue.yaml` active list. Update `meta.last_updated`.

### Step 12: Update Project Context (Incremental)

**If `--auto`: SKIP this step** — SubAgent should not spend time on context analysis. The main context (dev-agent) will handle this.

**Otherwise:** Analyze if this feature introduced changes that should be reflected in `project-context.md`. Check for: new dependencies, new code patterns, new directories, new test patterns, new anti-patterns. Skip if feature was a minor change.

### Step 13: Auto-Schedule Next

**If `--auto`: SKIP this step** — SubAgent does not handle scheduling. The main context (dev-agent) manages the auto-loop.

**Otherwise:** If `config.yaml` workflow.auto_start: true and pending list is not empty: start highest priority feature.

## Error Handling

| Error | Description | Solution |
|-------|-------------|----------|
| NOT_FOUND | Feature not in active list | Check ID |
| WORKTREE_NOT_FOUND | Worktree missing | Check if manually deleted |
| NOTHING_TO_COMMIT | No changes to commit | Confirm development done |
| REBASE_CONFLICT | Rebase conflict occurred | Manual: resolve. Auto: resolved automatically |
| TAG_EXISTS | Tag already exists | Use different tag name |
| GIT_ERROR | Git operation failed | Check Git status |

## Resume Option

Use `--resume` to continue after resolving conflicts. Skips Steps 1-3, goes directly to merge.

## Notes

1. Tag naming conflicts: Auto-append sequence number
2. Rebase conflicts: Manual mode requires user; Auto-Resolve handles automatically
3. Empty commits: Warn user if no changes
4. Branch recovery: Always possible via tag
5. SubAgent compatibility: Use `--auto` for full automation (auto-resolve + skip-checklist)
