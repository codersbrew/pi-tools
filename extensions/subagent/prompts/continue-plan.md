---
description: Coordinator resumes the remaining work in an existing tracked plan
---
Use the subagent tool to run the "coordinator" agent on this task:

Continue executing the remaining work in the tracked plan at: $@

Requirements:
- focus on tasks that are still `[ ]`, recover stale `[-]` tasks from interrupted runs, or can be retried from `[!]`
- use parallel worker subagents when tasks are independent and safe to batch
- update the shared plan file as work progresses
- discover repo-specific validation commands from the plan, package scripts, config files, or nearby tests before defaulting to generic commands
- require testing or an explicit rationale before marking tasks complete
- stop and summarize if no further safe progress can be made
