---
name: github-workflow
description: Use when working in a git repository hosted on GitHub and handling branch creation, commits, pushes, pull requests, reviews, or merges with gh CLI available.
---

# GitHub Workflow

## Overview

Use a hybrid workflow: prefer `gh` for GitHub-aware tasks, and use `git` for local history editing, staging, and branch mechanics.

**Opinionated defaults:**
- inspect repo state before making changes
- keep branches focused and short-lived
- use conventional-commit-style messages when possible
- open PRs with clear titles and summaries
- merge with explicit intent, not guesswork

## Quick Start Checks

Run these before branching or opening a PR:

```bash
gh auth status
git remote -v
gh repo view --json nameWithOwner,defaultBranchRef
```

Confirm:
- `gh` is authenticated
- the repo remote points to the expected GitHub repository
- you know the default branch, usually `main` or `master`

If `gh repo view` fails because the current repo is not connected to GitHub, fall back to plain `git` and ask before attempting GitHub-specific actions.

## Tool Choice Rules

| Use `gh` for | Use `git` for |
|---|---|
| auth and repo checks | staging files |
| PR create/view/checkout/review/merge | commit creation/amend/rebase |
| PR status and checks | switching branches |
| opening web pages for repo or PR context | inspecting local diffs and history |

**Fallback rule:** if `gh` has a clean command for the task, prefer it. If the task is fundamentally local source control, use `git`.

## Branch Workflow

1. Sync and inspect the default branch.
2. Create a focused branch from the default branch.
3. Keep the branch name descriptive.

Example:

```bash
git switch main
git pull --ff-only
git switch -c feat/add-github-workflow-skill
```

Recommended prefixes:
- `feat/`
- `fix/`
- `docs/`
- `chore/`
- `refactor/`
- `test/`

Avoid vague names like `updates`, `stuff`, or `misc-fixes`.

## Commit Workflow

Use `git` for staging and committing. Keep commits small and readable.

```bash
git status
git add <paths>
git commit -m "feat: add github workflow skill"
```

Prefer conventional-commit-style summaries:
- `feat: add github workflow skill`
- `fix: correct PR base branch detection`
- `docs: document packaged skills`
- `chore: clean up release notes`

Before pushing, review what changed:

```bash
git diff --staged
```

If a commit needs cleanup, use `git commit --amend` or interactive rebase deliberately. Do not use `gh` for local history surgery.

## Push and PR Workflow

Push with `git`, then use `gh` to work with the PR.

```bash
git push -u origin HEAD
gh pr create --fill --base main
```

Useful `gh` commands:

```bash
gh pr status
gh pr view --web
gh pr checks
gh pr create --fill --base <default-branch>
gh pr checkout <number>
```

PR hygiene:
- make sure the base branch is correct
- use a title that matches the change
- include a short summary of what changed and any risk areas
- mention tests run when relevant

If `--fill` produces a weak title/body, replace it instead of accepting low-quality PR text.

## Review Workflow

Use `gh` to inspect and respond to review state.

```bash
gh pr view <number>
gh pr diff <number>
gh pr checks <number>
gh pr review <number> --comment -b "Looks good overall; left one suggestion."
gh pr review <number> --approve
gh pr review <number> --request-changes -b "Please address the failing tests and rename the branch."
```

When reviewing your own work, check:
- PR targets the correct base branch
- branch is up to date enough for the repo's workflow
- checks are green or known failures are explained
- description matches the actual diff

## Merge Workflow

Prefer `gh pr merge` so the merge action is tied to GitHub PR state.

```bash
gh pr merge <number> --squash --delete-branch
```

Common variants:
- `--squash` for small or iterative branches
- `--merge` when the repo prefers merge commits
- `--rebase` when the repo explicitly prefers rebased history

Before merging, confirm:
- approvals or review requirements are satisfied
- required checks passed
- the chosen merge strategy matches repo norms

After merge, sync local state:

```bash
git switch main
git pull --ff-only
```

## Common Mistakes

- using `gh` for tasks that are really local `git` operations
- forgetting to verify the default branch before creating the PR
- pushing a branch without `-u` and then losing the upstream link
- opening a PR with an unhelpful auto-filled title/body
- merging without checking CI or review status
- mixing unrelated changes into one branch or one commit

## Red Flags

Stop and re-check before acting if you see any of these:
- `gh auth status` is not healthy
- the remote is not the repo you expected
- you do not know the correct base branch
- the branch name does not describe the change
- the PR title says one thing but the diff shows another
- checks are failing and no reason is documented

When unsure, inspect first, then act.
