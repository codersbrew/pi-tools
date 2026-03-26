---
description: Review a scoped implementation using the reviewer agent
---
Use the subagent tool to run the "reviewer" agent on this task:

Review this implementation scope: $@

Requirements:
- preserve any provided `Plan File`, `Task IDs`, `Files Changed`, and validation notes
- if file paths, diff scope, or plan output are provided, keep the review scoped to them
- prefer scoped diffs or targeted file inspection over repo-wide review
- report critical issues, warnings, suggestions, and a concise summary
- do not modify files or run builds
