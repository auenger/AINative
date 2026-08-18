---
description: 'Review feature documentation for quality, completeness, and potential issues before development begins.'
---

# Skill: review-spec

Review feature documentation (spec.md, task.md, checklist.md) for quality and potential issues. Acts as a **pre-development quality gate** — find problems early, propose fixes, and generate a structured review report with scoring.

## Usage

```
/review-spec <feature-id>                            # Full review with report
/review-spec <feature-id> --fix                      # Review + auto-apply fixes
/review-spec <feature-id> --dimension <dim>           # Review specific dimension only
/review-spec <feature-id> --no-archive                # Skip archive analysis
```

Options:
- `--fix`: Auto-apply suggested modifications (with confirmation)
- `--dimension <dim>`: Only review one dimension (`clarity`, `completeness`, `consistency`, `feasibility`, `gherkin`, `risk`)
- `--no-archive`: Skip progressive archive loading, review local docs only

## Position in Workflow

```
/new-feature → /enrich-feature → [/review-spec] → /start-feature → ...
                                    ↑ YOU ARE HERE
```

Designed for **pending** features after enrichment, before development starts. Can also review **active** features mid-development.

## Pre-flight Checks

1. Feature exists in `feature-workflow/queue.yaml` (pending or active list)
2. Feature directory exists (`features/pending-{id}/` or `features/active-{id}/`)
3. `spec.md` exists and is non-empty

If feature is active (not pending): warn that review is designed for pre-development, but proceed.

## Review Dimensions (6 Dimensions, 100 Points Total)

### D1: Clarity — 20 Points

Check for unambiguous, specific, and measurable requirements.

| # | Check Item | Pass Criteria | Severity on Fail |
|---|-----------|---------------|-----------------|
| 1 | Vague language | No "适当的"、"合理的"、"相关"、"等"、"类似" without concrete definition | Warning |
| 2 | Specific examples | Description includes concrete data examples or quantified criteria | Warning |
| 3 | Scope boundary | Clear IN/OUT scope definition (what this feature does NOT do) | Critical |
| 4 | Measurable outcomes | No subjective criteria like "good UX", "fast response" without metric | Warning |
| 5 | Role clarity | User story specifies a concrete role (not generic "user") | Suggestion |

### D2: Completeness — 20 Points

Check for missing scenarios, edge cases, and non-functional requirements.

| # | Check Item | Pass Criteria | Severity on Fail |
|---|-----------|---------------|-----------------|
| 1 | Boundary scenarios | Gherkin covers empty data, max values, concurrent access | Warning |
| 2 | Error paths | At least 1 sad-path Gherkin scenario per value point | Critical |
| 3 | Non-functional needs | Performance, security, i18n considerations mentioned (if relevant) | Suggestion |
| 4 | Data validation | Input validation rules explicitly stated | Warning |
| 5 | Authorization | Auth/permission requirements specified (if applicable) | Warning |
| 6 | Rollback behavior | Failure recovery or undo mechanism described | Suggestion |

### D3: Consistency — 20 Points

Check alignment between spec, tasks, and checklist.

| # | Check Item | Pass Criteria | Severity on Fail |
|---|-----------|---------------|-----------------|
| 1 | spec ↔ task alignment | Every Gherkin scenario has at least one corresponding task | Critical |
| 2 | spec ↔ checklist | Checklist covers all acceptance criteria from spec | Warning |
| 3 | Parent-child alignment | Sub-feature value points derive from parent spec (if applicable) | Warning |
| 4 | Terminology consistency | Same concept uses same term throughout all documents | Suggestion |
| 5 | Task dependency order | Task list respects dependency ordering | Warning |

### D4: Feasibility — 20 Points

Check technical alignment and conflict-free requirements.

| # | Check Item | Pass Criteria | Severity on Fail |
|---|-----------|---------------|-----------------|
| 1 | Architecture fit | Requirements align with project-context.md architecture | Critical |
| 2 | Pattern consistency | Spec references existing code patterns correctly | Warning |
| 3 | Requirement conflicts | No contradictions between scenarios or tasks | Critical |
| 4 | Dependency validity | All dependent features are completed or in progress | Warning |
| 5 | Reference file existence | Files referenced in Context Analysis actually exist | Warning |

### D5: Gherkin Quality — 20 Points

Check quality and coverage of acceptance scenarios.

| # | Check Item | Pass Criteria | Severity on Fail |
|---|-----------|---------------|-----------------|
| 1 | Testability | `Then` steps are objectively verifiable (not subjective) | Critical |
| 2 | GWT completeness | Every scenario has Given + When + Then (no missing parts) | Critical |
| 3 | Concreteness | Uses specific data values, not abstract descriptions | Warning |
| 4 | Value point coverage | Every user value point has at least 1 Gherkin scenario | Critical |
| 5 | Happy + sad paths | Mix of success and failure scenarios | Warning |

### D6: Risk Identification — Supplemental (not scored)

Identify potential risks that could derail development.

| # | Check Item | Risk Level |
|---|-----------|------------|
| 1 | Scope creep | Feature may grow beyond stated scope |
| 2 | External dependencies | Relies on external services or third-party libraries |
| 3 | Performance impact | Could degrade existing system performance |
| 4 | Breaking changes | May break existing functionality |
| 5 | Data migration | Requires database schema changes |

## Execution Steps

### Step 1: Load Context

Gather all review source material:

1. **Target feature files**: `features/{pending|active}-{id}/spec.md`, `task.md`, `checklist.md`
2. **Project context**: `project-context.md` (if exists)
3. **Parent spec**: if `parent` field is set, read parent `spec.md`
4. **Sibling specs**: read sibling sub-features' `spec.md` (if applicable)
5. **Configuration**: `feature-workflow/config.yaml` (tech stack, project conventions)

### Step 2: Level 1 — Archive Index Scan

Unless `--no-archive` is specified:

1. Read `features/archive/archive-log.yaml`
   - If file doesn't exist: skip archive analysis, continue with local review
2. Extract keywords from feature name, description, and value points
3. Match against archived features:
   - Keyword overlap (case-insensitive)
   - Same category
   - `related_features[]` bidirectional match
4. Rank by relevance score (keyword overlap × 3, same category × 2, direct dependency × 5)
5. Select top 3-5 candidates for potential deep-load
6. **Special focus**: prioritize archives with `verification.issues` or conflict records (historical lessons)

Present Level 1 summary:
```
Archive context for review:

  [Score: 20] feat-auth | User Authentication | 2026-03-02
    keywords: [auth, jwt, login] | verification issues: 2

  [Score: 12] feat-rbac | Role-Based Access | 2026-03-10
    keywords: [rbac, permission] | verification issues: 0

  → Deep-loading top 3 for historical lessons...
```

### Step 3: Level 2 — SubAgent Deep Archive Load (Optional)

If top-ranked archives exist AND have verification issues or high relevance:

Spawn **Agent Tool** (`general-purpose` SubAgent):

```
You are an Archive Review Agent. Analyze archived features to extract lessons for reviewing a new feature.

Target feature: {id} — {name}
Domain keywords: {keywords}

Archived features to analyze: {ranked_ids}

For each archived feature:
1. Glob features/archive/done-{id}-*/ to find the directory
2. Read spec.md → extract: what was planned
3. Read task.md → extract: what was actually done, any issues noted
4. Read evidence/verification-report.md (if exists) → extract: issues found during verification
5. Read checklist.md (if exists) → extract: quality standards used

Return a structured summary:

## Historical Lessons
- Common pitfalls in this domain
- Scenarios that were missed in original specs
- Testing blind spots discovered during verification
- Edge cases that surfaced late

## Pattern Issues
- Patterns that caused problems (anti-patterns to avoid)
- Integration issues with existing features

## Checklist Supplements
- Additional review items based on past failures

Be specific. Reference actual scenarios, issues, and resolutions found in archives.
```

If SubAgent fails: fall back to Level 1 index data only. Log warning and continue.

### Step 4: Execute Dimension Reviews

For each dimension (or single dimension if `--dimension` specified):

**Review method:**
1. Apply each check item in the dimension's checklist
2. Mark each as ✅ (pass) or ❌ (fail with issue)
3. For failures: generate an issue entry with:
   - **ID**: C1, C2... (Critical), W1, W2... (Warning), S1, S2... (Suggestion)
   - **Location**: file + section + specific paragraph
   - **Problem**: clear description of the issue
   - **Impact**: what happens if not fixed
   - **Suggestion**: concrete fix with before/after example

**Cross-validation between files:**
- Extract all Gherkin scenario names from spec.md
- Extract all task items from task.md
- Map scenarios → tasks (every scenario should have tasks)
- Map tasks → scenarios (every task should trace to a scenario or spec requirement)
- Flag unmapped items

**Parent-child validation (if sub-feature):**
- Read parent spec value points
- Verify each child spec covers a distinct subset
- Check for gaps (parent value points with no child coverage)
- Check for overlaps (two children claiming same value point)

**Reference validation:**
- Extract file paths from "Reference Code" / "需要参考的现有代码" section
- Verify each referenced file exists using Glob
- Flag non-existent references

### Step 5: Risk Assessment

Analyze the feature for risk factors (D6). This does NOT affect the score but is reported separately:

1. **Scope creep indicators**:
   - Vague descriptions that could expand ("and related features", "etc.")
   - Missing scope boundaries
   - Feature depends on undefined external systems

2. **External dependencies**:
   - Third-party API calls
   - External service integrations
   - Library version requirements

3. **Performance impact**:
   - Database-heavy operations
   - Large data processing
   - High-frequency API calls

4. **Breaking changes**:
   - Modifying existing API contracts
   - Changing database schema
   - Altering shared components

5. **Data migration**:
   - New database tables or columns
   - Data format changes
   - Backward compatibility concerns

### Step 6: Calculate Scores

**Per-dimension scoring:**
```
Dimension Score = (passed_items / total_items) × 20
```

**Total score:** Sum of D1 through D5 (D6 is supplemental, not scored)

**Quality gate assessment:**

| Score | Status | Recommendation |
|-------|--------|---------------|
| ≥ 80 | ✅ PASS | Ready for development |
| 60-79 | ⚠️ CAUTION | Fix Warnings before starting |
| < 60 | 🔴 BLOCK | Fix Critical issues and re-review |

### Step 7: Generate Report

#### Terminal Output (Summary)

```
Spec Review: {id} {name}
════════════════════════════════════

  Score: {total}/100  [{PASS|CAUTION|BLOCK}]
  Critical: {N}  Warning: {N}  Suggestion: {N}

  Dimension Scores:
    D1 Clarity:      {score}/20
    D2 Completeness: {score}/20  {← if < 16}
    D3 Consistency:  {score}/20  {← if < 16}
    D4 Feasibility:  {score}/20  {← if < 16}
    D5 Gherkin:      {score}/20  {← if < 16}

  Risk Items: {N}

  Report saved: features/{pending|active}-{id}/review-report.md
```

#### File Report (Full)

Save to `features/{pending|active}-{id}/review-report.md`:

```markdown
# Spec Review Report: {id} {name}

## Review Summary
- **Date**: {timestamp}
- **Feature ID**: {id}
- **Feature Name**: {name}
- **Status**: {pending|active}
- **Total Score**: {score}/100 [{PASS|CAUTION|BLOCK}]
- **Issues**: Critical: {N} | Warning: {N} | Suggestion: {N}

## Critical Issues

### C1: {issue title}
- **Location**: {file} > {section} > {paragraph}
- **Dimension**: {D1-D5}
- **Problem**: {detailed description}
- **Impact**: {consequence if not fixed}
- **Suggested Fix**:
  ```
  Original: "{original text}"
  Suggested: "{fixed text}"
  ```

{... more critical issues ...}

## Warnings

### W1: {issue title}
- **Location**: {file} > {section}
- **Dimension**: {D1-D5}
- **Problem**: {description}
- **Suggestion**: {how to fix}

{... more warnings ...}

## Improvement Suggestions

### S1: {suggestion title}
- **Location**: {file} > {section}
- **Dimension**: {D1-D5}
- **Suggestion**: {improvement idea}

{... more suggestions ...}

## Risk Assessment

| # | Risk | Level | Mitigation |
|---|------|-------|------------|
| 1 | {risk description} | {High/Medium/Low} | {suggested mitigation} |

## Dimension Score Details

### D1 Clarity: {score}/20
- [✅] Vague language check
- [✅] Specific examples
- [❌] Scope boundary — not defined
- [✅] Measurable outcomes
- [❌] Role clarity — generic "user" used

### D2 Completeness: {score}/20
{...}

### D3 Consistency: {score}/20
{...}

### D4 Feasibility: {score}/20
{...}

### D5 Gherkin Quality: {score}/20
{...}

## Archive Context Used
- Level 1: {N} features scanned
- Level 2: {N} features deep-loaded
- Key lessons: {summary of archive-derived insights}

## Overall Assessment
{2-3 sentence summary with priority fix recommendations}
```

### Step 8: --fix Mode (Optional)

If `--fix` flag is specified:

1. Collect all suggested fixes from the report
2. Present a summary of proposed changes:
   ```
   Proposed fixes for {id}:

   spec.md:
     [C1] Add scope boundary section → Missing OUT items
     [W2] Add error scenario for empty input → New Gherkin scenario

   task.md:
     [W1] Add task for error handling → Maps to W2 scenario

   Apply these fixes? [Y/n]
   ```
3. On confirmation, apply fixes using Edit tool
4. Append "Changes Applied" section to review-report.md:
   ```markdown
   ## Changes Applied
   - {timestamp}: Applied C1 fix — added scope boundary to spec.md
   - {timestamp}: Applied W2 fix — added error scenario to spec.md
   - {timestamp}: Applied W1 fix — added task to task.md
   ```
5. Re-run scoring on modified files and update scores

## Integration Points

### With /new-feature
After `/new-feature` completes, show hint:
> 💡 Use `/review-spec {id}` to check documentation quality before starting development.

### With /enrich-feature
If `config.yaml` has `workflow.review.after_enrich: true`:
After `/enrich-feature` completes, automatically suggest or trigger review.

### With /dev-agent
If `config.yaml` has `workflow.review.enabled: true`:
Before `/start-feature`, dev-agent checks if review has been done:
- If `review-report.md` exists and score ≥ `workflow.review.min_score`: proceed
- If score < `min_score` AND `workflow.review.auto_block: true`: auto-block feature
- If no review exists: proceed with warning

## Config Integration

Add to `feature-workflow/config.yaml`:

```yaml
workflow:
  review:
    enabled: false             # Enable pre-development review gate
    after_enrich: true         # Suggest review after enrich-feature
    min_score: 70              # Minimum score to pass quality gate
    auto_block: false          # Auto-block features scoring below min_score
```

## Error Handling

| Error | Description | Solution |
|-------|-------------|----------|
| NOT_FOUND | Feature ID not in queue | Check ID, use /list-features |
| NOT_PENDING | Feature is active, not pending | Warn and proceed with review |
| NO_SPEC | spec.md missing or empty | Error exit — spec.md is required |
| NO_TASK | task.md missing | Warn, skip D3 task-related checks |
| NO_CHECKLIST | checklist.md missing | Warn, skip D3 checklist-related checks |
| NO_ARCHIVES | archive-log.yaml doesn't exist | Skip archive analysis, local review only |
| SUBAGENT_FAILED | Level 2 deep-load failed | Fall back to Level 1 index data, continue |
| FIX_CONFLICT | --fix would overwrite user changes | Show diff, ask for confirmation |

## Notes

1. **Quality gate, not blocker** — review identifies issues but doesn't prevent development unless configured to do so
2. **Progressive loading** — Level 1 (index scan) is always fast; Level 2 (SubAgent) only fires for top-ranked archives with relevant lessons
3. **Archive lessons inform, not dictate** — historical issues guide review but don't override feature-specific needs
4. **Score is directional** — 72/100 vs 75/100 is not meaningfully different; focus on the issue list
5. **Cross-file validation is key value** — catching spec/task misalignment is the most impactful check
6. **Idempotent** — running multiple times produces the same report (updated with any fixes applied)
7. **Works on any feature** — not limited to enriched features; can review basic /new-feature output too
