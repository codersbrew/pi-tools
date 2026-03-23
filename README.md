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

Bundled defaults:
- built-in agents: `scout`, `planner`, `reviewer`, `worker`, `coordinator`
- packaged prompt templates: `/plan`, `/execute-plan`, `/continue-plan`, `/implement`, `/scout-and-plan`, `/implement-and-review`
- tracked markdown plans written to `plan/*.md` with task IDs, status checkboxes, dependency metadata, and validation steps
- coordinators can fan out safe parallel worker batches and update shared plan files as work completes
- live streaming of subagent progress, tool calls, usage, and final markdown output

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
/continue-plan plan/add-redis-caching.md
/implement add Redis caching to the session store
/scout-and-plan refactor auth to support OAuth
/implement-and-review add input validation to API endpoints
```

Tracked plans are written to `plan/*.md`. Tasks are checked off in place, blocked tasks are marked explicitly, and testing/type-checking is required before coordinated workflows mark implementation tasks complete.

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
