# Subagent

Delegate tasks to specialized subagents with isolated context windows.

This copy is bundled inside `@codersbrew/pi-tools` as a package-ready adaptation of pi's `subagent` example.

## What's included

- extension entry point: `index.ts`
- agent discovery logic: `agents.ts`
- bundled default agents: `agents/*.md`
- bundled workflow prompts: `prompts/*.md`

## Bundled defaults

The package ships these default agents:
- `scout`
- `planner`
- `reviewer`
- `worker`

And these prompt templates:
- `/implement`
- `/scout-and-plan`
- `/implement-and-review`

## Override precedence

Bundled agents are always available as fallbacks.

Override them by creating agents with the same name in:
1. `~/.pi/agent/agents/*.md` for personal overrides
2. `.pi/agents/*.md` for project overrides

When `agentScope: "both"` is used, project agents override user agents, and user agents override bundled package agents.

## Security model

This tool executes a separate `pi` subprocess with a delegated system prompt and tool/model configuration.

Project-local agents can instruct the model to read files, run bash commands, and make edits. Only enable project agents for repositories you trust.

When running interactively, the tool prompts for confirmation before running project-local agents. Set `confirmProjectAgents: false` to disable that confirmation.

## Usage examples

### Single agent

```text
Use scout to find all authentication code
```

### Parallel execution

```text
Run 2 scouts in parallel: one to find models, one to find providers
```

### Chained workflow

```text
Use a chain: first have scout find the read tool, then have planner suggest improvements
```

### Prompt templates

```text
/implement add Redis caching to the session store
/scout-and-plan refactor auth to support OAuth
/implement-and-review add input validation to API endpoints
```

## Agent definitions

Agents are markdown files with YAML frontmatter:

```markdown
---
name: my-agent
description: What this agent does
tools: read, grep, find, ls
model: claude-haiku-4-5
---

System prompt for the agent goes here.
```
