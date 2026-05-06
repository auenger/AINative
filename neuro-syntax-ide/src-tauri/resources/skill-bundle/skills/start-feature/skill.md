---
description: 'Start development on a feature - create branch and worktree.'
---

# Skill: start-feature

Start development on a feature by creating a Git branch and worktree.
Supports parent/child feature relationships and dependency chains.

## Usage

```
/start-feature <feature-id>
```

## Pre-flight Checks

### Check 1: Feature Exists
- Find the feature in `feature-workflow/queue.yaml` pending list
- If not found, return NOT_FOUND error
- If found in blocked list, return BLOCKED error

### Check 2: Parallelism Limit
- Read `feature-workflow/config.yaml` `parallelism.max_concurrent`
- Count active features in `queue.yaml`
- If `active.count >= max_concurrent`: return LIMIT_EXCEEDED error
- Show current active features

### Check 3: Dependencies Satisfied
- Check feature's dependencies field
- Verify all dependencies are completed (in `features/archive/archive-log.yaml`)
- If unsatisfied: return DEPENDENCY_ERROR, show missing dependencies

### Check 4: Parent Feature Status (for child features)
- If feature has a parent: parent must be active or completed
- If parent is pending/blocked: return PENDING_DEPENDENCY error

### Check 5: Child Features Status (for parent features)
- If feature has children: no children should be active
- If any children active: return CHILD_ACTIVE error

## Execution Steps

### Step 1: Get Feature Info
Read from `queue.yaml` pending list:
- name, priority, dependencies, parent, children, size

### Step 2: Rename Directory
```bash
mv features/pending-{id} features/active-{id}
```

### Step 3: Create Git Branch

Read from `feature-workflow/config.yaml`:
```yaml
project:
  main_branch: main
git:
  remote: origin
```

```bash
MAIN_BRANCH={config.project.main_branch || "main"}
REMOTE={config.git.remote || "origin"}
cd {repo_path}  # if repo_path configured
git checkout {main_branch}
git pull {remote} {main_branch}
git checkout -b feature/{slug}
```

Branch name format: `{branch_prefix}/{slug}` (prefix from config, default "feature").

### Step 4: Create Worktree
```bash
git checkout {main_branch}
git worktree add ../OA_Tool-{slug} feature/{slug}
```

Worktree path: `{worktree_base}/{worktree_prefix}-{slug}` (from config).

### Step 5: Update Queue
Update `feature-workflow/queue.yaml`:
- Remove from pending list
- Add to active list with branch, worktree, started timestamp
- Update `meta.last_updated`

## Output

```
feature {id} started!

branch: feature/{slug}
worktree: ../OA_Tool-{slug}
size: {size}
parent: {parent or "none"}
children: {children or "none"}

start developing:
  cd ../OA_Tool-{slug}

view tasks:
  cat features/active-{id}/task.md
```

## Error Handling

| Error | Description | Solution |
|-------|-------------|----------|
| NOT_FOUND | Feature not in pending list | Check ID, use /list-features |
| BLOCKED | Feature is blocked | Check reason, use /unblock-feature |
| LIMIT_EXCEEDED | Parallel limit reached | Complete active features or increase limit |
| DEPENDENCY_ERROR | Dependencies not satisfied | Complete dependent features first |
| PENDING_DEPENDENCY | Parent feature not started | Start parent feature first |
| CHILD_ACTIVE | Child features still active | Wait for children to complete |
| BRANCH_EXISTS | Branch already exists | Delete old branch or use different name |
| WORKTREE_ERROR | Worktree creation failed | Check path permissions |
| GIT_ERROR | Git operation failed | Check git status |

## Rollback Strategy

| Failure Point | Rollback Action |
|---------------|-----------------|
| Step 2 rename failed | No rollback needed |
| Step 3 branch failed | No rollback needed |
| Step 4 worktree failed | Delete branch, rename dir back to pending |
| Step 5 queue update failed | Delete worktree, delete branch, rename dir |
