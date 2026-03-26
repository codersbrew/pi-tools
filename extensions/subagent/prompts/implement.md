---
description: Planner investigates and creates a tracked plan, then executor writes and executes it
---
Use the subagent tool with the chain parameter to execute this workflow:

1. First, use the "planner" agent to investigate the codebase and create a tracked markdown implementation plan for: $@

The plan must include a `Plan File` under `plan/`, task IDs, dependencies, parallelizable markers, status checkboxes, and validation/testing steps.
2. Then, use the "executor" agent to materialize exactly this planner output in the current project's `plan/` directory and then execute the tracked plan it describes:
{previous}

Before writing the plan, if the current project is a git repo, create or reuse a focused feature branch for this new plan when it is safe to do so. If already on a non-default branch, keep it and report it. If the checkout is dirty in a way that makes branching unsafe, stop and report that instead of guessing. Reuse the same plan file if it already exists and matches closely enough to resume safely. Recover stale `[-]` tasks from interrupted runs, use parallel worker subagents when tasks are independent, update the shared plan file as work progresses, and enforce repo-appropriate testing/type-checking before marking tasks complete. Return the full structured executor output, including `## Plan File`, `## Task IDs`, `## Files Changed`, and `## Validation Summary`.

Execute this as a chain, passing output between steps via {previous}.
