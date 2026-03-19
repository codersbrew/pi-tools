# GitHub Workflow Skill Implementation Plan

> **REQUIRED SUB-SKILL:** Use the executing-plans skill to implement this plan task-by-task.

**Goal:** Add a packaged GitHub workflow skill that guides branching, committing, pushing, PR creation, review, and merge work with a preference for `gh` CLI and clear fallback rules for `git`.

**Architecture:** Add a new `skills/github-workflow/SKILL.md` directory to the package, expose it through `package.json`, and verify the package includes the skill and its metadata. Keep the skill opinionated but generic: setup checks, repo inspection, branch/commit/PR hygiene, and a hybrid `gh`-first workflow with explicit `git` fallbacks.

**Tech Stack:** Pi skills, npm package manifest, Node built-in test runner

---

### Task 1: Add failing verification for packaged skill

**Files:**
- Create: `test/github-workflow-skill.test.mjs`
- Test: `package.json`

**Step 1: Write failing test**

Assert that:
- `package.json` includes `skills` in `files`
- `package.json.pi.skills` includes `./skills`
- `skills/github-workflow/SKILL.md` exists
- the skill frontmatter has `name: github-workflow`
- the description starts with `Use when`

**Step 2: Run test to verify it fails**

Run: `node --test test/github-workflow-skill.test.mjs`
Expected: FAIL because the skill file and package manifest entries do not exist yet

### Task 2: Author the skill

**Files:**
- Create: `skills/github-workflow/SKILL.md`

**Step 1: Write minimal skill content**

Include:
- frontmatter with valid skill name and trigger-focused description
- setup checks for `gh auth status`, repo remotes, default branch
- branch workflow with naming guidance
- commit workflow with conventional-commit-friendly guidance
- PR create, view, checkout, review, and merge flows using `gh`
- explicit fallback rules for plain `git`
- common mistakes / red flags

**Step 2: Keep the scope basic**

Avoid repo-specific policy, CI wiring, or organization-specific rules.

### Task 3: Expose the skill in the package

**Files:**
- Modify: `package.json`
- Modify: `README.md`

**Step 1: Update manifest**

Add:
- `skills` to the published `files`
- `./skills` to `pi.skills`

**Step 2: Update docs**

Document the new bundled skill and how to invoke it with `/skill:github-workflow`.

### Task 4: Verify package readiness

**Files:**
- Verify: `skills/github-workflow/SKILL.md`
- Verify: `package.json`
- Verify: `README.md`
- Verify: `test/github-workflow-skill.test.mjs`

**Step 1: Run focused tests**

Run: `node --test test/github-workflow-skill.test.mjs`
Expected: PASS

**Step 2: Run full checks**

Run: `npm test && npm run pack:check`
Expected: PASS and dry-run tarball includes `skills/github-workflow/SKILL.md`
