# @codersbrew/pi-tools

A publishable [pi](https://github.com/badlogic/pi-mono) package that bundles CodersBrew's custom pi extensions.

## Included extensions

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

The root `package.json` exposes them through:

```json
{
  "pi": {
    "extensions": ["./extensions"]
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

Recommended release flow:

1. Update the package version in `package.json`
2. Commit the change
3. Create and push a version tag such as `v0.1.0`
4. GitHub Actions will run verification, publish to npm, and create a GitHub release

Publishing supports either of these setups:
- **npm trusted publishing** with GitHub Actions OIDC
- **`NPM_TOKEN` secret** as a fallback

If you use manual dispatch, ensure the version in `package.json` has not already been published.

## License

MIT
