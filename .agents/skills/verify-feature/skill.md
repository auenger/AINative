---
description: 'Verify feature completion by checking tasks, running tests, and validating Gherkin acceptance scenarios.'
---

# Skill: verify-feature

Verify that a feature is complete by checking tasks, running tests, and validating Gherkin acceptance scenarios.

**For frontend features:**
- **Method A (Preferred)**: Use Playwright MCP for real-time browser interaction
- **Method B (Fallback)**: Use `npx playwright test` with auto-generated E2E tests

Both methods capture screenshots, trace files, and HTML reports as evidence.

## Usage

```
/verify-feature <feature-id> [options]
```

Options:
- `--auto-fix`: Automatically fix test failures and lint errors (for SubAgent use)
- `--auto`: Shorthand for `--auto-fix` (full auto mode for SubAgent)
- `--max-retries=<n>`: Maximum auto-fix retry attempts (default: 2)

## Pre-flight Checks

- Feature must be in `feature-workflow/queue.yaml` active list
- Feature directory exists at `features/active-{id}/`

### Feature Directory Path Resolution

**IMPORTANT**: Evidence MUST be saved to `features/active-{id}/evidence/`. Never write evidence to `pending-{id}`.

Before proceeding, resolve the feature directory:

1. Check `features/active-{id}/` — use this if it exists (normal case)
2. If only `features/pending-{id}/` exists: warn that `/start-feature` should be run first, but proceed with pending as working directory
3. If BOTH `active-{id}/` and `pending-{id}/` exist with evidence in pending:
   - Move any evidence from `pending-{id}/evidence/` to `active-{id}/evidence/`
   - This handles cases where a previous verify run wrote to the wrong path
4. Use the resolved `{feature_dir}` variable for all subsequent steps

## Execution Steps

### Step 1: Check Task Completion

Read `features/active-{id}/task.md`:
- Count total tasks and completed tasks (checked boxes)
- List incomplete tasks

### Step 2: Run Code Quality Checks

In the worktree:
```bash
cd {worktree_path}
# Lint errors (if configured), type errors (if TypeScript), obvious code smells
```

### Step 3: Run Unit/Integration Tests

If tests exist:
```bash
npm test  # or appropriate test command
```

Record: tests run, passed, failed.

### Step 4: Detect Feature Type

Determine if frontend testing is needed:
```yaml
frontend_indicators:
  - spec.md contains "UI/交互验收点" section
  - spec.md Gherkin scenarios mention page interactions
  - Component files exist (*.tsx, *.vue, *.svelte, *.jsx)
  - Page/Route files exist (pages/, routes/, app/)
  - spec.md has "页面" or "界面" or "按钮" keywords
```

### Step 5: Validate Gherkin Acceptance Scenarios

Read `features/active-{id}/spec.md` and extract all Gherkin scenarios.

#### 5.1 For Backend/Non-UI Features: Code Analysis

Analyze implementation code to verify Given/When/Then expectations are met.

#### 5.2 For Frontend Features: Playwright Testing

**5.2.1 Check Playwright MCP Availability**
- Look for tools like `playwright_navigate`, `playwright_click`, `playwright_fill`
- Available -> Method A: Playwright MCP
- NOT available -> Method B: `npx playwright test`

**5.2.1 Clean Old Reports**

Before running any Playwright tests, clean stale evidence to ensure a fresh report:

```bash
cd {worktree_path}/frontend
rm -rf evidence/playwright-report evidence/test-results.json evidence/test-artifacts
```

Also clean the feature directory's evidence (from previous verify runs):

```bash
rm -rf features/active-{feature-id}/evidence/playwright-report
rm -rf features/active-{feature-id}/evidence/test-artifacts
rm -f features/active-{feature-id}/evidence/test-results.json
```

**5.2.2 Method A: Playwright MCP (Preferred)**

For each Gherkin scenario, execute steps via Playwright MCP tools:

```
Step: Given 用户在登录页面
  Action: Navigate to /login
  Tool: playwright_navigate
  Screenshot: features/active-{id}/evidence/screenshots/scenario-1-step-1.png
```

**5.2.3 Method B: npx playwright test (Fallback)**

1. Create evidence directories:
```bash
mkdir -p features/active-{feature-id}/evidence/{screenshots,traces,playwright-report,e2e-tests}
```

2. Check/create `playwright.config.ts` with trace, screenshot, and HTML/JSON reporters.

3. Generate E2E tests from Gherkin scenarios:
```typescript
// e2e/{feature-id}.spec.ts
import { test, expect } from '@playwright/test';

test('Scenario: 用户登录成功', async ({ page }) => {
  await page.goto('/login');
  await page.fill('input#username', 'testuser');
  await page.fill('input#password', 'password123');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/');
  await expect(page.locator('.welcome')).toContainText('testuser');
});
```

4. Run tests:
```bash
npm run dev &
npx playwright test --trace on --screenshot on --reporter=html,json e2e/{feature-id}.spec.ts
```

5. Copy evidence to feature directory:
```bash
cp e2e/{feature-id}.spec.ts features/active-{id}/evidence/e2e-tests/
cp test-results/*/trace.zip features/active-{id}/evidence/traces/
```

**5.2.4 Copy Evidence from Worktree to Feature Directory**

After Playwright tests complete, copy all generated evidence from the worktree to the feature directory so it survives worktree cleanup during complete-feature.

```bash
EVIDENCE_SRC="{worktree_path}/frontend/evidence"
EVIDENCE_DST="features/active-{feature-id}/evidence"
mkdir -p "$EVIDENCE_DST"

# Copy Playwright HTML report
if [ -d "$EVIDENCE_SRC/playwright-report" ]; then
  cp -r "$EVIDENCE_SRC/playwright-report" "$EVIDENCE_DST/"
fi

# Copy JSON test results
if [ -f "$EVIDENCE_SRC/test-results.json" ]; then
  cp "$EVIDENCE_SRC/test-results.json" "$EVIDENCE_DST/"
fi

# Copy test artifacts (screenshots + traces)
if [ -d "$EVIDENCE_SRC/test-artifacts" ]; then
  cp -r "$EVIDENCE_SRC/test-artifacts" "$EVIDENCE_DST/"
fi
```

**Fallback**: If evidence paths differ from the defaults above, check `playwright.config.ts` `reporter` and `outputDir` settings and adjust source paths accordingly.

### Step 6: Save Verification Report

Create `features/active-{id}/evidence/verification-report.md` with:
- Task completion summary
- Test results
- Gherkin scenario details (pass/fail per scenario with screenshots and traces)
- Quality check results
- Issues list

### Step 7: Update Checklist

Read and update `features/active-{id}/checklist.md`:
- Mark completed items `[x]` based on verification results
- Append Verification Record section with timestamp, status, results summary, evidence paths

### Step 8: Generate Summary Report

Display overall verification status with task count, test results, Gherkin scenario results, evidence location, and issues.

## Evidence Directory Structure

```
features/active-{feature-id}/
└── evidence/
    ├── verification-report.md
    ├── test-results.json
    ├── playwright-report/
    ├── e2e-tests/               # E2E test scripts (archived with feature)
    │   └── {feature-id}.spec.ts
    ├── screenshots/
    └── traces/
```

## Auto-Fix Workflow (`--auto-fix` / `--auto`)

When enabled, test failures and lint errors are automatically resolved:

```
Error Detected
  -> Attempt 1: Analyze & Fix
     -> Parse error, identify root cause, read source files, apply fix, re-run
        -> Success -> Continue
        -> Still failing -> Attempt 2
  -> Attempt 2: Alternative Fix
     -> Re-analyze, try different approach, re-run
        -> Success -> Continue
        -> Still failing -> Max retries reached
  -> Max retries reached -> Log diagnostics, mark as "warning", proceed (do NOT block pipeline)
```

### Auto-Fix Strategies

| Error Type | Fix Strategy |
|------------|-------------|
| AssertionError | Analyze expected vs actual, fix implementation logic |
| ImportError | Check dependency, install, verify path |
| TypeError | Read type annotations, fix type mismatch |
| SyntaxError | Fix syntax, re-run |
| Lint errors | Read lint rule, apply fix, re-run lint |
| Type check errors | Fix type annotations, re-run type check |

### Auto-Fix Constraints

```yaml
auto_fix_rules:
  max_retries: 2
  timeout_per_attempt: 120s
  never_modify: [config.yaml, other_feature_files]
  always_log: [original_error, fix_applied, retry_result]
  on_exhausted:
    action: continue
    status: warning
```

## Error Handling

| Error | Description | Solution |
|-------|-------------|----------|
| NOT_ACTIVE | Feature not in active list | Check ID |
| WORKTREE_NOT_FOUND | Worktree missing | Run /start-feature |
| TEST_FAILURE | Unit tests failing | Auto-fix (if --auto-fix) or manual fix |
| SCENARIO_FAILED | Gherkin scenario not satisfied | Auto-fix (if --auto-fix) or check evidence |
| PLAYWRIGHT_MCP_UNAVAILABLE | Playwright MCP not configured | Fallback to npx playwright test |
| PLAYWRIGHT_NOT_INSTALLED | Playwright not in project | Run npm install -D @playwright/test |
| DEV_SERVER_NOT_RUNNING | Frontend dev server not running | Auto-start or manual start |
