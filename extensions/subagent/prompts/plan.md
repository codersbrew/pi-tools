---
description: Scout gathers context, planner creates a tracked plan, worker writes it to plan/
---
Use the subagent tool with the chain parameter to execute this workflow:

1. First, use the "scout" agent to find all code relevant to: $@
2. Then, use the "planner" agent to create a tracked markdown implementation plan for "$@" using this scout output as context:
{previous}

The plan must include a `Plan File` under `plan/`, task IDs, dependencies, parallelizable markers, status checkboxes, and validation/testing steps.
3. Finally, use the "worker" agent to materialize exactly this planner output as a markdown file in the current project's `plan/` directory:
{previous}

Create the directory if needed. Do NOT implement the tasks yet; just write the plan file and return the full structured worker output, including a `## Plan File` section and any notes about collisions or reuse.

Execute this as a chain, passing output between steps via {previous}. Do NOT implement the plan.
