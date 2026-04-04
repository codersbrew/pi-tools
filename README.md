# @codersbrew/pi-tools

A publishable [pi](https://github.com/badlogic/pi-mono) package that bundles CodersBrew pi extensions, skills, and prompt templates.

## Included resources

### Extensions

#### `security`
Protects common dangerous tool operations by:
- warning or blocking risky `bash` commands such as `rm -rf`, `sudo`, and destructive disk operations
- blocking writes to sensitive paths like `.env`, `.git`, `node_modules`, SSH keys, and common secrets files
- prompting before lockfile edits such as `package-lock.json`, `yarn.lock`, and `pnpm-lock.yaml`

#### `session-breakdown`
Adds an interactive TUI for analyzing pi session history from `~/.pi/agent/sessions`, including:
- sessions, messages, tokens, and cost over the last 7 / 30 / 90 days
- model, cwd, day-of-week, and time-of-day breakdowns
- contribution-style heatmap visualizations

#### `update-pi`
Adds a `/update-pi` slash command that upgrades `@mariozechner/pi-coding-agent` using your detected package manager (or configured `npmCommand`) and reminds you to restart pi afterward.

#### `subagent`
Delegates work to specialized subagents that run in isolated `pi` subprocesses.

Primary bundled agents:
- `planner` - investigates the codebase and produces tracked plans
- `executor` - materializes, executes, resumes, and updates tracked plans
- `reviewer` - performs an independent read-only review pass

Internal helper:
- `worker` - delegated implementation helper used by the executor

Primary prompt templates:
- `/plan`
- `/execute-plan`
- `/implement`
- `/implement-and-review`
- `/review`

Tracked markdown plans are written to `plan/*.md` with task IDs, status checkboxes, dependency metadata, and validation steps. Executors can fan out safe parallel worker batches, resume interrupted work, and update shared plan files as work completes.

Override behavior:
- packaged agents act as defaults
- `~/.pi/agent/agents/*.md` overrides packaged agents of the same name
- `.pi/agents/*.md` overrides both packaged and user-level agents when `agentScope: "project"` or `"both"`

### Skill: `github-workflow`
An opinionated GitHub workflow skill for branch creation, commits, pushes, PR creation, review, and merge work.

It prefers `gh` for GitHub-aware actions and uses plain `git` where local source-control operations are the better tool.

Invoke it in pi with:

```bash
/skill:github-workflow
```

### Skill: `plan`
A `/plan`-style planning skill that investigates the codebase and writes a tracked markdown plan under `plan/`, but does the work in the current conversation context instead of delegating to the bundled subagent workflow.

It is useful when you want the same planning output shape as `/plan` without spinning up a separate planner/executor process.

Invoke it in pi with:

```bash
/skill:plan add Redis caching to the session store
```

## Install

Global install:

```bash
pi install npm:@codersbrew/pi-tools
```

Project-local install:

```bash
pi install -l npm:@codersbrew/pi-tools
```

You can also add it manually to pi settings:

```json
{
  "packages": ["npm:@codersbrew/pi-tools"]
}
```

## Using the bundled subagent workflows

After installing the package, the prompt templates are available directly in pi:

```bash
/plan add Redis caching to the session store
/execute-plan plan/add-redis-caching.md
/implement add Redis caching to the session store
/implement-and-review add input validation to API endpoints
/review src/api/handlers.ts src/api/validation.ts
```

Tracked plans are written to `plan/*.md`. New-plan workflows create or reuse a focused git branch before materializing the plan when the checkout is clean enough to do so safely. Tasks are checked off in place, blocked tasks are marked explicitly, and testing/type-checking is required before executors mark implementation tasks complete.

If you want the same tracked-plan output without subagent delegation, use the skill instead:

```bash
/skill:plan add Redis caching to the session store
```

To customize or add agents, create markdown agent files in either:
- `~/.pi/agent/agents/` for your personal defaults
- `.pi/agents/` for project-local agents

## Package structure

This package uses pi's standard package manifest and currently publishes:
- `extensions/security.ts`
- `extensions/session-breakdown.ts`
- `extensions/update-pi.ts`
- `extensions/subagent/index.ts`
- `skills/github-workflow/SKILL.md`
- `skills/plan/SKILL.md`
- `extensions/subagent/prompts/*.md`

The root `package.json` exposes them through:

```json
{
  "pi": {
    "extensions": ["./extensions"],
    "skills": ["./skills"],
    "prompts": ["./extensions/subagent/prompts"]
  }
}
```

## Local development

Install dependencies:

```bash
npm install
```

Run local verification:

```bash
npm run check
```

Preview the publish tarball:

```bash
npm pack --dry-run
```

## Releasing

This repo includes `.github/workflows/release.yml`.

Ongoing release flow:

1. Update the package version in `package.json`
2. Commit and push the change
3. Create and push a matching version tag such as `v0.3.0`
4. GitHub Actions will run verification, publish to npm, and create a GitHub release

The workflow supports either:
- npm trusted publishing via GitHub OIDC
- `NPM_TOKEN` fallback publishing when the secret is present

If you use manual dispatch, ensure the version in `package.json` has not already been published.

## License

MIT
