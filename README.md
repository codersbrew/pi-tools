# @codersbrew/pi-tools

A publishable [pi](https://github.com/badlogic/pi-mono) package that bundles CodersBrew's custom pi extensions and skills.

## Included resources

### Extensions

### `security`
Protects common dangerous tool operations by:
- warning or blocking risky `bash` commands such as `rm -rf`, `sudo`, and destructive disk operations
- blocking writes to sensitive paths like `.env`, `.git`, `node_modules`, SSH keys, and common secrets files
- prompting before lockfile edits such as `package-lock.json`, `yarn.lock`, and `pnpm-lock.yaml`

### `session-breakdown`
Adds an interactive TUI for analyzing pi session history from `~/.pi/agent/sessions`, including:
- sessions, messages, tokens, and cost over the last 7 / 30 / 90 days
- model, cwd, day-of-week, and time-of-day breakdowns
- contribution-style heatmap visualizations

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

## Package structure

This package uses pi's standard package manifest:
- `extensions/security.ts`
- `extensions/session-breakdown.ts`
- `skills/github-workflow/SKILL.md`

The root `package.json` exposes them through:

```json
{
  "pi": {
    "extensions": ["./extensions"],
    "skills": ["./skills"]
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

### First release bootstrap

Because npm trusted publishing is configured per existing package, the **first publish** of a brand new package must use an `NPM_TOKEN` GitHub secret.

Bootstrap steps for `@codersbrew/pi-tools`:

1. Create an npm access token with publish rights
2. Add it to the GitHub repo as `NPM_TOKEN`
3. Confirm `package.json` has the intended version
4. Push a matching version tag such as `v0.2.0`
5. GitHub Actions will verify the package, publish it, and create a GitHub release

### Switch to trusted publishing after first release

After the package exists on npm, configure npm Trusted Publisher for this repository:

- **Provider:** GitHub Actions
- **Organization or user:** `codersbrew`
- **Repository:** `pi-tools`
- **Workflow filename:** `release.yml`
- **Environment name:** leave blank unless you later add a GitHub Environment

After trusted publishing is configured, remove the `NPM_TOKEN` secret if you want future releases to publish via GitHub OIDC instead of a token.

### Ongoing release flow

1. Update the package version in `package.json`
2. Commit and push the change
3. Create and push a matching version tag such as `v0.2.0`
4. GitHub Actions will run verification, publish to npm, and create a GitHub release

The workflow uses Node 24 so the npm CLI is new enough for trusted publishing and provenance support.

If you use manual dispatch, ensure the version in `package.json` has not already been published.

## License

MIT
