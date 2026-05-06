---
description: 'Create a new feature request through interactive dialogue, generate documentation, and add to queue.'
---

# Skill: new-feature

Create a new feature request. Collect requirements through dialogue, analyze complexity, potentially split into multiple features, generate documentation, and add to the development queue.

## Execution Steps

### Step 0: Load Project Context

Before creating any feature, load project context to understand the codebase.

**Context Loading Priority:**
1. Check `project-context.md` -> Read and load
2. Check `CLAUDE.md` -> Read and offer to convert
3. Trigger Quick Explore -> Scan project structure, tech stack, code patterns, generate `project-context.md`

**Quick Explore checks:**
1. Read package.json/requirements.txt for dependencies
2. Check config files (tsconfig.json, vite.config.ts, etc.)
3. Identify framework and language versions
4. List main directories, identify code organization
5. Scan files for naming conventions and import patterns

### Step 1: Collect Information

Extract or ask for:
- **name**: Feature name (short, e.g., "User Authentication")
- **description**: Detailed description
- **priority**: 1-100 (default: 50, higher = more urgent)
- **dependencies**: List of other feature IDs (optional)

### Step 2: AI Analysis - Identify User Value Points & Generate Scenarios

Analyze the feature description to:
1. Identify independent user value points (distinct capabilities that enable meaningful user outcomes)
2. Generate Gherkin format acceptance scenarios for each value point

**Gherkin Scenario Generation Rules:**
- Each value point: 1-3 scenarios
- Include happy path and error cases
- Use Given-When-Then format
- Be specific and testable
- For frontend: include UI interaction steps

### Step 3: Size Assessment and Split Decision

| Value Points | Size | Action |
|--------------|------|--------|
| 1 | Small | Create directly |
| 2 | Medium | Create directly (optional split suggestion) |
| 3+ | Large | **Recommend split** |

If value points >= 3: Propose split into sub-features with dependency chain.
If value points = 2: Offer keep or split.

### Step 4: Generate Feature ID(s)

- Single: `{prefix}-{slug}` (e.g., "User Authentication" -> "feat-user-auth")
- Split: base slug + suffix from each value point (e.g., "feat-auth-login", "feat-auth-register")
- Prefix from `feature-workflow/config.yaml` (default "feat")

### Step 5: Check for Conflicts

Check if ID exists in:
1. `features/pending-{id}/`
2. `features/active-{id}/`
3. `features/archive/done-{id}/`
4. `feature-workflow/queue.yaml`

If conflict: suggest `{id}-2`.

### Step 6: Create Feature Directory and Files

Create `features/pending-{id}/` with:

**spec.md:**
```markdown
# Feature: {id} {name}

## Basic Information
- **ID**: {id}
- **Name**: {name}
- **Priority**: {priority}
- **Size**: {S|M|L}
- **Dependencies**: {dependencies}
- **Parent**: {parent_id or null}
- **Children**: {child_ids or empty}
- **Created**: {timestamp}

## Description
{user-provided description}

## User Value Points
{ai_generated_value_points}

## Context Analysis
### Reference Code
### Related Documents
### Related Features

## Technical Solution
<!-- To be filled during implementation -->

## Acceptance Criteria (Gherkin)
### User Story
### Scenarios (Given/When/Then)
### UI/Interaction Checkpoints (if frontend)
### General Checklist
```

**task.md:**
```markdown
# Tasks: {id}
## Task Breakdown
### 1. Module/Component
- [ ] Task item 1
## Progress Log
| Date | Progress | Notes |
```

**checklist.md:**
```markdown
# Checklist: {id}
## Completion Checklist
### Development
- [ ] All tasks completed
- [ ] Code self-tested
### Code Quality
- [ ] Code style follows conventions
### Testing
- [ ] Unit tests written (if needed)
- [ ] Tests passing
### Documentation
- [ ] spec.md technical solution filled
```

For split features: each sub-feature gets its own directory with Size "S", parent set to original ID, dependencies on previous sub-features.

### Step 7: Update Queue

Add to `feature-workflow/queue.yaml` pending list. Sort by priority (descending). Update `meta.last_updated`.

For split features: create parent entry with `split: true` and children list, plus individual sub-feature entries.

### Step 8: Check Auto-Start

Read `feature-workflow/config.yaml`:
- If `workflow.auto_start: true` AND `active.count < max_concurrent`: start feature (first sub-feature for splits)

## Output

```
Feature created successfully!

ID: {id}
Size: {S|M|L}
Directory: features/pending-{id}

Documents:
- spec.md      Requirements specification
- task.md      Task breakdown
- checklist.md Completion checklist

Status: pending (waiting for development)
```

## Error Handling

| Error | Description | Solution |
|-------|-------------|----------|
| ID_CONFLICT | ID already exists | Use different name or accept suggested ID |
| QUEUE_ERROR | Failed to update queue | Check queue.yaml permissions |
| TEMPLATE_ERROR | Template processing failed | Check templates directory |
| PERMISSION_ERROR | Cannot create directory | Check filesystem permissions |
| SPLIT_ABORTED | User aborted split | Create as single feature with warning |

## Notes

1. **User value first** - Split by user value, not technical layers
2. **Dependency chain** - Sub-features depend on previous ones
3. **Context protection** - Splitting prevents AI context overflow
4. **Parent tracking** - Parent feature tracks all children
