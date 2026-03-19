# Pi Tools Package Implementation Plan

> **REQUIRED SUB-SKILL:** Use the executing-plans skill to implement this plan task-by-task.

**Goal:** Create a publish-ready `@codersbrew/pi-tools` npm package that bundles the `security` and `session-breakdown` pi extensions and includes automated release workflow support.

**Architecture:** Use pi package conventions with an `extensions/` directory and a root `package.json` `pi` manifest so `pi install npm:@codersbrew/pi-tools` auto-discovers the bundled extensions. Keep the source extensions as direct copied TypeScript files, add lightweight repository metadata and verification scripts, and publish through GitHub Actions using npm trusted publishing or an npm token secret.

**Tech Stack:** npm package metadata, TypeScript, pi package manifest, GitHub Actions, Changesets-free tag/manual release flow

---

### Task 1: Bootstrap package skeleton

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `README.md`
- Create: `LICENSE`
- Create: `tsconfig.json`
- Create: `.npmrc`

**Step 1: Write the package manifest**

Create `package.json` with:
- `name: "@codersbrew/pi-tools"`
- `version: "0.1.0"`
- `type: "module"`
- `keywords` including `pi-package`
- `pi.extensions` pointing at `./extensions`
- `files` including `extensions`, `README.md`, and `LICENSE`
- `peerDependencies` for `@mariozechner/pi-coding-agent`, `@mariozechner/pi-tui`, and `@sinclair/typebox` only if needed by copied extensions
- scripts for `typecheck`, `pack:check`, and `check`

**Step 2: Add repository scaffolding**

Create:
- `.gitignore` for `node_modules/`, npm logs, generated tarballs, and editor noise
- `.npmrc` with `access=public`
- `LICENSE` using MIT unless the user specifies another license later
- `tsconfig.json` configured for noEmit package validation

**Step 3: Run manifest sanity check**

Run: `cd /tmp/pi-tools && npm install`
Expected: installs dependencies without manifest errors

### Task 2: Copy and organize the selected pi extensions

**Files:**
- Create: `extensions/security.ts`
- Create: `extensions/session-breakdown.ts`

**Step 1: Copy extension sources**

Copy:
- `~/.pi/agent/extensions/security.ts` -> `extensions/security.ts`
- `~/.pi/agent/extensions/session-breakdown.ts` -> `extensions/session-breakdown.ts`

**Step 2: Validate imports and package requirements**

Ensure copied files import only packages declared in `peerDependencies` or Node built-ins.

**Step 3: Run typecheck**

Run: `cd /tmp/pi-tools && npm run typecheck`
Expected: TypeScript resolves package imports and reports zero errors

### Task 3: Document installation and usage

**Files:**
- Modify: `README.md`

**Step 1: Add package overview**

Document that the package bundles:
- `security`
- `session-breakdown`

**Step 2: Add install instructions**

Document:
- `pi install npm:@codersbrew/pi-tools`
- project-local install with `pi install -l npm:@codersbrew/pi-tools`
- manual settings.json example if useful

**Step 3: Add extension summaries**

Describe what each extension does, plus any caveats for `session-breakdown` reading `~/.pi/agent/sessions`.

### Task 4: Add automated release workflow

**Files:**
- Create: `.github/workflows/release.yml`

**Step 1: Create release workflow**

Create a GitHub Actions workflow that:
- runs on pushes to `main` affecting package files and on manual dispatch
- checks out code
- sets up Node 20+
- runs `npm ci`
- runs `npm run check`
- runs `npm pack --dry-run`
- publishes to npm on version tags or manual dispatch using `NODE_AUTH_TOKEN`

**Step 2: Document required secrets/setup**

Reference in workflow comments and README that publishing requires either npm trusted publishing or `NPM_TOKEN`.

### Task 5: Verify publish readiness

**Files:**
- Verify: `package.json`
- Verify: `extensions/security.ts`
- Verify: `extensions/session-breakdown.ts`
- Verify: `.github/workflows/release.yml`
- Verify: `README.md`

**Step 1: Run the full verification command**

Run: `cd /tmp/pi-tools && npm run check && npm pack --dry-run`
Expected: all checks pass and tarball preview includes only intended package files

**Step 2: Inspect git status**

Run: `cd /tmp/pi-tools && git status --short`
Expected: only intentional new files are present

**Step 3: Commit**

Run:
```bash
git -C /tmp/pi-tools add .
git -C /tmp/pi-tools commit -m "feat: bootstrap pi tools package"
```

**Step 4: Push**

Run:
```bash
git -C /tmp/pi-tools push -u origin main
```
Expected: repository contains the package bootstrap on GitHub
