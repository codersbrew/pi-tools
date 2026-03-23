---
description: Full workflow - scout gathers context, planner creates a tracked plan, worker writes it, coordinator executes it
---
Use the subagent tool with the chain parameter to execute this workflow:

1. First, use the "scout" agent to find all code relevant to: $@
2. Then, use the "planner" agent to create a tracked markdown implementation plan for "$@" using this scout output as context:
{previous}

The plan must include a `Plan File` under `plan/`, task IDs, dependencies, parallelizable markers, status checkboxes, and validation/testing steps.
3. Then, use the "worker" agent to materialize exactly this planner output as a markdown file in the current project's `plan/` directory:
{previous}

Before writing the plan, if the current project is a git repo, create or reuse a focused feature branch for this new plan when it is safe to do so. If already on a non-default branch, keep it and report it. If the checkout is dirty in a way that makes branching unsafe, stop and report that instead of guessing. Then create the directory if needed. Do NOT implement the tasks yet; just write the plan file and return the full structured worker output, including a `## Plan File` section and any notes about collisions, branch choice, or reuse.
4. Finally, use the "coordinator" agent to execute the tracked plan described in this worker output:
{previous}

The coordinator should extract the plan file path from the worker output, use parallel worker subagents when tasks are independent, update the shared plan file as work progresses, recover stale `[-]` tasks from interrupted runs, and enforce repo-appropriate testing/type-checking before marking tasks complete.

Execute this as a chain, passing output between steps via {previous}.
