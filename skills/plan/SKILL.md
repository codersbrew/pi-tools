---
name: plan
description: Use when the user wants /skill:plan to perform the bundled /plan workflow directly in the current conversation context, without delegating to the subagent tool.
---

# Plan

Create a tracked markdown implementation plan under `plan/` in the current project, but do it entirely in the current conversation context.

## Non-Negotiable Rules

- Do **not** use the `subagent` tool.
- Stay in the current context for investigation, planning, and file writing.
- Do **not** implement the requested work.
- Use read-only investigation until you are ready to write the plan file.
- Prefer repo-specific validation commands discovered from project files over generic defaults.
- If the repository state makes safe branching or plan materialization ambiguous, stop and report the blocker instead of guessing.

## Required Workflow

### 1. Inspect repo state first

If the current project is a git repository:

- inspect the current branch and working tree first
- determine the default branch as safely as possible
- if already on a non-default branch, keep it and report it
- if on the default branch with a clean enough checkout, create a focused feature branch before writing the plan
- if the checkout is dirty in a way that makes switching branches unsafe, stop and report that instead of guessing

Use concise, safe commands such as:

```bash
git status --short --branch
git symbolic-ref --quiet refs/remotes/origin/HEAD
git branch --show-current
```

If `origin/HEAD` is unavailable, infer the default branch carefully from local refs or common branch names like `main` and `master`. If this is not a git repo, continue without branching.

### 2. Investigate in the current context

Use the normal tools available in the current session to understand the work:

- use `bash` for read-only discovery commands such as `rg`, `find`, `ls`, and `git grep`
- use `read` to inspect the relevant files
- follow imports, types, config, tests, and nearby patterns
- discover likely implementation touch points and likely new files
- discover validation commands from `package.json`, CI config, test config, lint/typecheck scripts, or nearby focused tests

Do not change source files during this investigation.

### 3. Write a tracked plan under `plan/`

Materialize a markdown plan file in the current project:

- choose a short kebab-case file name under `plan/`, for example `plan/add-redis-caching.md`
- create `plan/` if needed
- if the target file already exists, reuse it only when the content is effectively the same or the user explicitly wants to resume/update it
- otherwise choose a clearly non-destructive alternate file name or report the collision
- write the final markdown plan to disk

### 4. Stop after plan materialization

After writing the plan file:

- do not implement any tasks
- do not modify any code files beyond creating or updating the plan file
- return a structured summary of what you did

## Plan Markdown Requirements

Use this exact structure for the saved plan markdown:

```md
# Plan: <short title>

- Request: <original request summary>
- Plan File: `plan/<kebab-name>.md`
- Status: active
- Status Legend: `[ ]` not started, `[-]` in progress, `[x]` done, `[!]` blocked

## Goal
<one concise paragraph>

## Architecture Decisions
- <decision>
- <decision>

## Task Checklist

### [ ] T01 - <task title>
- Depends on: none | `T02, T03`
- Parallelizable: yes | no
- Files:
  - `path/to/file`
- Validation:
  - [ ] `<command or artifact>`
  - [ ] `<command or artifact>`
- Notes:
  - <important sequencing or implementation detail>

### [ ] T02 - <task title>
- Depends on: `T01`
- Parallelizable: yes | no
- Files:
  - `path/to/file`
- Validation:
  - [ ] `<command or artifact>`
- Notes:
  - <important sequencing or implementation detail>

## Risks
- <risk>

## Coordination Notes
- Group tasks that do not share file ownership into parallel worker batches.
- The executor should materialize this plan before implementation work begins.
- Do not mark a task done until its validation items have passed or an explicit rationale is recorded.
- Update the checklist in place as work progresses.
```

## Planning Guidance

- Prefer 3-10 tasks unless the request is truly tiny.
- Use stable task IDs like `T01`, `T02`, `T03`.
- Keep tasks independently actionable.
- Mark `Parallelizable: yes` only when tasks can safely run in parallel.
- Keep file paths concrete and mention likely new files where appropriate.
- Keep risks and open questions brief and relevant.
- If the user already provided scoped files or findings, use them.

## Final Response Format

After the plan file is written, return this exact structure:

```md
## Mode
`plan-materialization`

## Plan File
`plan/...md` | `none`

## Branch
`branch-name` | `unchanged` | `none`

## Status
`completed` | `blocked`

## Task IDs
- `T01`
- `T02`

## Files Changed
- `plan/...md`

## Tasks Completed
- none

## Tasks In Progress
- none

## Tasks Blocked
- none

## Validation Summary
- planning only; no implementation validation run

## Notes
Important context, including branch choice, collisions, reuse decisions, or blockers.
```

Base the plan on the user request appended below when this skill is invoked via `/skill:plan ...`.
