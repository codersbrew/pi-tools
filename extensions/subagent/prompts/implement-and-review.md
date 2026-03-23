---
description: Coordinated implementation workflow with tracked plan, review, and feedback application
---
Use the subagent tool with the chain parameter to execute this workflow:

1. First, use the "scout" agent to find all code relevant to: $@
2. Then, use the "planner" agent to create a tracked markdown implementation plan for "$@" using this scout output as context:
{previous}

The plan must include a `Plan File` under `plan/`, task IDs, dependencies, parallelizable markers, status checkboxes, and validation/testing steps.
3. Then, use the "worker" agent to materialize exactly this planner output as a markdown file in the current project's `plan/` directory:
{previous}

Create the directory if needed. Do NOT implement the tasks yet; just write the plan file and return the full structured worker output, including a `## Plan File` section and any notes about collisions or reuse.
4. Then, use the "coordinator" agent to execute the tracked plan described in this worker output:
{previous}

The coordinator should extract the plan file path from the worker output, use parallel worker subagents when tasks are independent, update the shared plan file as work progresses, recover stale `[-]` tasks from interrupted runs, and enforce repo-appropriate testing/type-checking before marking tasks complete.
5. Then, use the "reviewer" agent to review the implementation using this coordinator output as scope:
{previous}

Preserve the plan file path, task IDs, affected files, and validation notes in the review output when they are available.
6. Finally, use the "coordinator" agent to apply the review feedback described in this review output:
{previous}

Reuse the same plan file, reopen any affected tasks, rerun impacted validation, and update the tracked plan in place.

Execute this as a chain, passing output between steps via {previous}.
