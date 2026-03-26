---
description: Planner investigates the codebase, creates a tracked plan, and executor writes it to plan/
---
Use the subagent tool with the chain parameter to execute this workflow:

1. First, use the "planner" agent to investigate the codebase and create a tracked markdown implementation plan for: $@

The plan must include a `Plan File` under `plan/`, task IDs, dependencies, parallelizable markers, status checkboxes, and validation/testing steps.
2. Then, use the "executor" agent to materialize exactly this planner output as a markdown file in the current project's `plan/` directory without implementing the tasks yet:
{previous}

Before writing the plan, if the current project is a git repo, create or reuse a focused feature branch for this new plan when it is safe to do so. If already on a non-default branch, keep it and report it. If the checkout is dirty in a way that makes branching unsafe, stop and report that instead of guessing. Then create the directory if needed. Do NOT implement the tasks yet; just write the plan file and return the full structured executor output, including `## Mode`, `## Plan File`, `## Branch`, and any notes about collisions, branch choice, or reuse.

Execute this as a chain, passing output between steps via {previous}. Do NOT implement the plan.
