import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "@mariozechner/jiti";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const packageJsonPath = path.join(projectRoot, "package.json");
const subagentIndexPath = path.join(projectRoot, "extensions/subagent/index.ts");
const bundledPlannerPath = path.join(projectRoot, "extensions/subagent/agents/planner.md");
const bundledExecutorPath = path.join(projectRoot, "extensions/subagent/agents/executor.md");
const bundledReviewerPath = path.join(projectRoot, "extensions/subagent/agents/reviewer.md");
const bundledWorkerPath = path.join(projectRoot, "extensions/subagent/agents/worker.md");
const removedScoutPath = path.join(projectRoot, "extensions/subagent/agents/scout.md");
const removedCoordinatorPath = path.join(projectRoot, "extensions/subagent/agents/coordinator.md");
const bundledPlanPromptPath = path.join(projectRoot, "extensions/subagent/prompts/plan.md");
const bundledExecutePlanPromptPath = path.join(projectRoot, "extensions/subagent/prompts/execute-plan.md");
const bundledImplementPromptPath = path.join(projectRoot, "extensions/subagent/prompts/implement.md");
const bundledImplementAndReviewPromptPath = path.join(projectRoot, "extensions/subagent/prompts/implement-and-review.md");
const bundledReviewPromptPath = path.join(projectRoot, "extensions/subagent/prompts/review.md");
const removedContinuePlanPromptPath = path.join(projectRoot, "extensions/subagent/prompts/continue-plan.md");
const removedScoutAndPlanPromptPath = path.join(projectRoot, "extensions/subagent/prompts/scout-and-plan.md");

function readPackageJson() {
	return JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
}

function readProjectFile(relativePath) {
	return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

function createPiStyleJiti() {
	return createJiti(import.meta.url, {
		moduleCache: false,
		alias: {
			"@mariozechner/pi-coding-agent": path.join(projectRoot, "node_modules/@mariozechner/pi-coding-agent/dist/index.js"),
			"@mariozechner/pi-tui": path.join(projectRoot, "node_modules/@mariozechner/pi-tui/dist/index.js"),
		},
	});
}

test("package publishes only the simplified subagent agents and primary prompts", () => {
	const pkg = readPackageJson();

	assert.ok(pkg.files.includes("extensions"), "package.json files should include extensions");
	assert.ok(pkg.pi?.extensions?.includes("./extensions"), "package.json pi.extensions should include ./extensions");
	assert.ok(
		pkg.pi?.prompts?.includes("./extensions/subagent/prompts"),
		"package.json pi.prompts should include ./extensions/subagent/prompts",
	);

	assert.ok(fs.existsSync(subagentIndexPath), "extensions/subagent/index.ts should exist");
	assert.ok(fs.existsSync(bundledPlannerPath), "extensions/subagent/agents/planner.md should exist");
	assert.ok(fs.existsSync(bundledExecutorPath), "extensions/subagent/agents/executor.md should exist");
	assert.ok(fs.existsSync(bundledReviewerPath), "extensions/subagent/agents/reviewer.md should exist");
	assert.ok(fs.existsSync(bundledWorkerPath), "extensions/subagent/agents/worker.md should exist");
	assert.equal(fs.existsSync(removedScoutPath), false, "extensions/subagent/agents/scout.md should not exist");
	assert.equal(
		fs.existsSync(removedCoordinatorPath),
		false,
		"extensions/subagent/agents/coordinator.md should not exist",
	);
	assert.ok(fs.existsSync(bundledPlanPromptPath), "extensions/subagent/prompts/plan.md should exist");
	assert.ok(fs.existsSync(bundledExecutePlanPromptPath), "extensions/subagent/prompts/execute-plan.md should exist");
	assert.ok(fs.existsSync(bundledImplementPromptPath), "extensions/subagent/prompts/implement.md should exist");
	assert.ok(
		fs.existsSync(bundledImplementAndReviewPromptPath),
		"extensions/subagent/prompts/implement-and-review.md should exist",
	);
	assert.ok(fs.existsSync(bundledReviewPromptPath), "extensions/subagent/prompts/review.md should exist");
	assert.equal(
		fs.existsSync(removedContinuePlanPromptPath),
		false,
		"extensions/subagent/prompts/continue-plan.md should not exist",
	);
	assert.equal(
		fs.existsSync(removedScoutAndPlanPromptPath),
		false,
		"extensions/subagent/prompts/scout-and-plan.md should not exist",
	);
});

test("subagent loads through pi's extension loader aliases", async () => {
	const jiti = createPiStyleJiti();
	const factory = await jiti.import(subagentIndexPath, { default: true });
	assert.equal(typeof factory, "function");
});

test("primary prompts explicitly hand off between planner, executor, and reviewer", () => {
	const planPrompt = readProjectFile("extensions/subagent/prompts/plan.md");
	const implementPrompt = readProjectFile("extensions/subagent/prompts/implement.md");
	const implementAndReviewPrompt = readProjectFile("extensions/subagent/prompts/implement-and-review.md");
	const reviewPrompt = readProjectFile("extensions/subagent/prompts/review.md");

	assert.match(planPrompt, /use the "planner" agent to investigate the codebase/i);
	assert.match(planPrompt, /materialize exactly this planner output[\s\S]*\n\{previous\}/);
	assert.match(planPrompt, /use the "executor" agent/i);
	assert.doesNotMatch(planPrompt, /use the "scout" agent/i);
	assert.doesNotMatch(planPrompt, /use the "worker" agent/i);
	assert.match(implementPrompt, /materialize exactly this planner output[\s\S]*\n\{previous\}/);
	assert.match(implementPrompt, /execute the tracked plan it describes:\n\{previous\}/);
	assert.match(implementAndReviewPrompt, /review the implementation using this executor output as scope:\n\{previous\}/);
	assert.match(implementAndReviewPrompt, /apply the review feedback described in this review output:\n\{previous\}/);
	assert.match(reviewPrompt, /run the "reviewer" agent/i);
	assert.match(reviewPrompt, /preserve any provided `Plan File`, `Task IDs`, `Files Changed`, and validation notes/);
});

test("new-plan workflows assign branch setup to executor while workers stay implementation-only", () => {
	const executorAgent = readProjectFile("extensions/subagent/agents/executor.md");
	const workerAgent = readProjectFile("extensions/subagent/agents/worker.md");
	const planPrompt = readProjectFile("extensions/subagent/prompts/plan.md");
	const implementPrompt = readProjectFile("extensions/subagent/prompts/implement.md");
	const implementAndReviewPrompt = readProjectFile("extensions/subagent/prompts/implement-and-review.md");

	assert.match(executorAgent, /If materializing a new plan inside a git repo, create or reuse a focused branch before writing the plan when it is safe to do so\./);
	assert.match(executorAgent, /If already on a non-default branch, keep it and report that branch in `## Notes`\./);
	assert.match(
		executorAgent,
		/If the working tree has unrelated uncommitted changes that make switching branches unsafe, stop and report the blocker instead of guessing\./,
	);
	assert.match(planPrompt, /create or reuse a focused feature branch for this new plan when it is safe to do so/);
	assert.match(implementPrompt, /create or reuse a focused feature branch for this new plan when it is safe to do so/);
	assert.match(implementAndReviewPrompt, /create or reuse a focused feature branch for this new plan when it is safe to do so/);
	assert.doesNotMatch(workerAgent, /Plan materialization mode/i);
	assert.doesNotMatch(workerAgent, /write a new plan inside a git repo/i);
	assert.match(workerAgent, /Do NOT edit the shared plan file unless the caller explicitly tells you to do so\./);
});

test("tracked-plan agents document validation discovery, interrupted-run recovery, and scoped review metadata", () => {
	const plannerAgent = readProjectFile("extensions/subagent/agents/planner.md");
	const executorAgent = readProjectFile("extensions/subagent/agents/executor.md");
	const reviewerAgent = readProjectFile("extensions/subagent/agents/reviewer.md");
	const executePlanPrompt = readProjectFile("extensions/subagent/prompts/execute-plan.md");

	assert.match(plannerAgent, /discover repo-specific validation commands and nearby tests\/config/i);
	assert.match(plannerAgent, /package\.json/);
	assert.match(plannerAgent, /Bash is for read-only discovery commands only/);
	assert.match(executorAgent, /Recover stale `\[-\]` tasks from interrupted runs/);
	assert.match(executorAgent, /## Mode/);
	assert.match(executorAgent, /## Branch/);
	assert.match(executorAgent, /## Task IDs/);
	assert.match(executorAgent, /## Files Changed/);
	assert.match(reviewerAgent, /If the input includes `Plan File`, `Task IDs`, or `Files Changed`/);
	assert.match(reviewerAgent, /## Validation Notes/);
	assert.match(executePlanPrompt, /run the "executor" agent/i);
	assert.match(executePlanPrompt, /recover stale `\[-\]` tasks from interrupted runs/);
	assert.match(executePlanPrompt, /discover repo-specific validation commands/);
});

test("resolvePreferredModel qualifies ambiguous bare model ids using the current provider", async () => {
	const jiti = createPiStyleJiti();
	const { resolvePreferredModel } = await jiti.import(subagentIndexPath);

	const resolved = resolvePreferredModel(
		"gpt-5.4, google/gemini-3.1-pro-preview",
		[
			{ id: "gpt-5.4", provider: "openai-codex" },
			{ id: "gpt-5.4", provider: "azure-openai-responses" },
			{ id: "gemini-3.1-pro-preview", provider: "google" },
		],
		"openai-codex",
	);

	assert.equal(resolved, "openai-codex/gpt-5.4");
});

test("resolvePreferredModel skips unavailable provider-qualified candidates and uses later matches", async () => {
	const jiti = createPiStyleJiti();
	const { resolvePreferredModel } = await jiti.import(subagentIndexPath);

	const resolved = resolvePreferredModel(
		"openai-codex/gpt-5.4, google/gemini-3.1-pro-preview",
		[{ id: "gemini-3.1-pro-preview", provider: "google" }],
	);

	assert.equal(resolved, "google/gemini-3.1-pro-preview");
});

test("resolvePreferredModel returns undefined when no preferred models are available", async () => {
	const jiti = createPiStyleJiti();
	const { resolvePreferredModel } = await jiti.import(subagentIndexPath);

	const resolved = resolvePreferredModel("gpt-5.4, google/gemini-3.1-pro-preview", []);

	assert.equal(resolved, undefined);
});

test("discoverAgents skips malformed files and invalidates cached directory reads when files change", async () => {
	const jiti = createPiStyleJiti();
	const { discoverAgents } = await jiti.import(path.join(projectRoot, "extensions/subagent/agents.ts"));

	const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-tools-subagent-cache-"));
	const agentDir = path.join(tmpDir, "agent-home");
	const userAgentsDir = path.join(agentDir, "agents");
	fs.mkdirSync(userAgentsDir, { recursive: true });

	const previousAgentDir = process.env.PI_CODING_AGENT_DIR;
	process.env.PI_CODING_AGENT_DIR = agentDir;

	try {
		fs.writeFileSync(
			path.join(userAgentsDir, "broken.md"),
			"---\nname: broken\ndescription: Broken\nmodel: [\n---\n\nThis file is intentionally malformed.",
		);
		fs.writeFileSync(
			path.join(userAgentsDir, "custom.md"),
			"---\nname: custom\ndescription: Alpha\n---\n\nOne.",
		);

		const first = discoverAgents(tmpDir, "user");
		assert.equal(first.agents.find((agent) => agent.name === "custom")?.description, "Alpha");
		assert.equal(first.agents.find((agent) => agent.name === "broken"), undefined);

		const customAgentPath = path.join(userAgentsDir, "custom.md");
		fs.writeFileSync(customAgentPath, "---\nname: custom\ndescription: Omega\n---\n\nTwo.");
		const bumpedTime = new Date(Date.now() + 2000);
		fs.utimesSync(customAgentPath, bumpedTime, bumpedTime);

		const second = discoverAgents(tmpDir, "user");
		assert.equal(second.agents.find((agent) => agent.name === "custom")?.description, "Omega");
	} finally {
		if (previousAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
		else process.env.PI_CODING_AGENT_DIR = previousAgentDir;
		fs.rmSync(tmpDir, { recursive: true, force: true });
	}
});

test("bundled primary agents are discoverable, removed aliases are gone, and overrides still work", async () => {
	const jiti = createPiStyleJiti();
	const { discoverAgents } = await jiti.import(path.join(projectRoot, "extensions/subagent/agents.ts"));

	const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-tools-subagent-"));
	const agentDir = path.join(tmpDir, "agent-home");
	const userAgentsDir = path.join(agentDir, "agents");
	const projectRootDir = path.join(tmpDir, "repo");
	const projectAgentsDir = path.join(projectRootDir, ".pi", "agents");
	fs.mkdirSync(userAgentsDir, { recursive: true });
	fs.mkdirSync(projectAgentsDir, { recursive: true });

	const previousAgentDir = process.env.PI_CODING_AGENT_DIR;
	process.env.PI_CODING_AGENT_DIR = agentDir;

	try {
		const bundledOnly = discoverAgents(projectRootDir, "user");
		const bundledPlanner = bundledOnly.agents.find((agent) => agent.name === "planner");
		const bundledExecutor = bundledOnly.agents.find((agent) => agent.name === "executor");
		const bundledReviewer = bundledOnly.agents.find((agent) => agent.name === "reviewer");
		const bundledWorker = bundledOnly.agents.find((agent) => agent.name === "worker");
		assert.ok(bundledPlanner, "bundled planner agent should be discovered");
		assert.ok(bundledExecutor, "bundled executor agent should be discovered");
		assert.ok(bundledReviewer, "bundled reviewer agent should be discovered");
		assert.ok(bundledWorker, "bundled worker agent should be discovered");
		assert.equal(bundledPlanner.source, "package");
		assert.equal(bundledExecutor.source, "package");
		assert.equal(bundledReviewer.source, "package");
		assert.equal(bundledWorker.source, "package");
		assert.equal(bundledOnly.agents.find((agent) => agent.name === "scout"), undefined);
		assert.equal(bundledOnly.agents.find((agent) => agent.name === "coordinator"), undefined);

		fs.writeFileSync(
			path.join(userAgentsDir, "executor.md"),
			"---\nname: executor\ndescription: User executor override\n---\n\nUser override.",
		);
		const withUserOverride = discoverAgents(projectRootDir, "user");
		assert.equal(withUserOverride.agents.find((agent) => agent.name === "executor")?.source, "user");

		fs.writeFileSync(
			path.join(projectAgentsDir, "executor.md"),
			"---\nname: executor\ndescription: Project executor override\n---\n\nProject override.",
		);
		const withProjectOverride = discoverAgents(path.join(projectRootDir, "src"), "both");
		assert.equal(withProjectOverride.agents.find((agent) => agent.name === "executor")?.source, "project");
	} finally {
		if (previousAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
		else process.env.PI_CODING_AGENT_DIR = previousAgentDir;
		fs.rmSync(tmpDir, { recursive: true, force: true });
	}
});
