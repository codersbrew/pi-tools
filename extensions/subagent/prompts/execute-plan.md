---
description: Coordinator executes an existing tracked plan with parallel workers and plan updates
---
Use the subagent tool to run the "coordinator" agent on this task:

Execute the tracked plan at: $@

Requirements:
- read the existing plan file
- recover stale `[-]` tasks from interrupted runs before dispatching new work
- use parallel worker subagents when tasks are independent and safe to batch
- update the shared plan file as tasks move through `[ ]`, `[-]`, `[x]`, and `[!]`
- discover repo-specific validation commands from the plan, package scripts, config files, or nearby tests before defaulting to generic commands
- require testing or an explicit rationale before marking tasks complete
- return the updated plan status summary with task IDs and changed files
