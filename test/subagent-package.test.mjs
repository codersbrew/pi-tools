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
const bundledScoutPath = path.join(projectRoot, "extensions/subagent/agents/scout.md");
const bundledCoordinatorPath = path.join(projectRoot, "extensions/subagent/agents/coordinator.md");
const bundledImplementPromptPath = path.join(projectRoot, "extensions/subagent/prompts/implement.md");
const bundledPlanPromptPath = path.join(projectRoot, "extensions/subagent/prompts/plan.md");
const bundledExecutePlanPromptPath = path.join(projectRoot, "extensions/subagent/prompts/execute-plan.md");
const bundledContinuePlanPromptPath = path.join(projectRoot, "extensions/subagent/prompts/continue-plan.md");

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

test("package publishes the subagent extension and prompts with pi metadata", () => {
	const pkg = readPackageJson();

	assert.ok(pkg.files.includes("extensions"), "package.json files should include extensions");
	assert.ok(pkg.pi?.extensions?.includes("./extensions"), "package.json pi.extensions should include ./extensions");
	assert.ok(
		pkg.pi?.prompts?.includes("./extensions/subagent/prompts"),
		"package.json pi.prompts should include ./extensions/subagent/prompts",
	);

	assert.ok(fs.existsSync(subagentIndexPath), "extensions/subagent/index.ts should exist");
	assert.ok(fs.existsSync(bundledScoutPath), "extensions/subagent/agents/scout.md should exist");
	assert.ok(fs.existsSync(bundledCoordinatorPath), "extensions/subagent/agents/coordinator.md should exist");
	assert.ok(fs.existsSync(bundledImplementPromptPath), "extensions/subagent/prompts/implement.md should exist");
	assert.ok(fs.existsSync(bundledPlanPromptPath), "extensions/subagent/prompts/plan.md should exist");
	assert.ok(fs.existsSync(bundledExecutePlanPromptPath), "extensions/subagent/prompts/execute-plan.md should exist");
	assert.ok(fs.existsSync(bundledContinuePlanPromptPath), "extensions/subagent/prompts/continue-plan.md should exist");
});

test("subagent loads through pi's extension loader aliases", async () => {
	const jiti = createPiStyleJiti();
	const factory = await jiti.import(subagentIndexPath, { default: true });
	assert.equal(typeof factory, "function");
});

test("tracked-plan chain prompts explicitly pass prior outputs between planning, materialization, execution, and review steps", () => {
	const planPrompt = readProjectFile("extensions/subagent/prompts/plan.md");
	const scoutAndPlanPrompt = readProjectFile("extensions/subagent/prompts/scout-and-plan.md");
	const implementPrompt = readProjectFile("extensions/subagent/prompts/implement.md");
	const implementAndReviewPrompt = readProjectFile("extensions/subagent/prompts/implement-and-review.md");

	assert.match(planPrompt, /using this scout output as context:\n\{previous\}/);
	assert.match(planPrompt, /materialize exactly this planner output[\s\S]*\n\{previous\}/);
	assert.match(planPrompt, /return the full structured worker output, including a `## Plan File` section/);
	assert.match(scoutAndPlanPrompt, /using this scout output as context:\n\{previous\}/);
	assert.match(scoutAndPlanPrompt, /materialize exactly this planner output[\s\S]*\n\{previous\}/);
	assert.match(scoutAndPlanPrompt, /return the full structured worker output, including a `## Plan File` section/);
	assert.match(implementPrompt, /materialize exactly this planner output[\s\S]*\n\{previous\}/);
	assert.match(implementPrompt, /return the full structured worker output, including a `## Plan File` section/);
	assert.match(implementPrompt, /execute the tracked plan described in this worker output:\n\{previous\}/);
	assert.match(implementAndReviewPrompt, /execute the tracked plan described in this worker output:\n\{previous\}/);
	assert.match(implementAndReviewPrompt, /return the full structured worker output, including a `## Plan File` section/);
	assert.match(implementAndReviewPrompt, /review the implementation using this coordinator output as scope:\n\{previous\}/);
	assert.match(implementAndReviewPrompt, /apply the review feedback described in this review output:\n\{previous\}/);
});

test("tracked-plan agents document validation discovery, interrupted-run recovery, and scoped review metadata", () => {
	const scoutAgent = readProjectFile("extensions/subagent/agents/scout.md");
	const plannerAgent = readProjectFile("extensions/subagent/agents/planner.md");
	const coordinatorAgent = readProjectFile("extensions/subagent/agents/coordinator.md");
	const reviewerAgent = readProjectFile("extensions/subagent/agents/reviewer.md");
	const executePlanPrompt = readProjectFile("extensions/subagent/prompts/execute-plan.md");
	const continuePlanPrompt = readProjectFile("extensions/subagent/prompts/continue-plan.md");

	assert.match(scoutAgent, /## Validation Commands/);
	assert.match(scoutAgent, /package\.json/);
	assert.match(plannerAgent, /Prefer validation commands discovered in the scout output/);
	assert.match(coordinatorAgent, /Recover stale `\[-\]` tasks from interrupted runs/);
	assert.match(coordinatorAgent, /## Task IDs/);
	assert.match(coordinatorAgent, /## Files Changed/);
	assert.match(reviewerAgent, /If the input includes `Plan File`, `Task IDs`, or `Files Changed`/);
	assert.match(reviewerAgent, /## Validation Notes/);
	assert.match(executePlanPrompt, /recover stale `\[-\]` tasks from interrupted runs/);
	assert.match(executePlanPrompt, /discover repo-specific validation commands/);
	assert.match(continuePlanPrompt, /recover stale `\[-\]` tasks from interrupted runs/);
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

test("bundled subagent agents act as defaults and can be overridden", async () => {
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
		const bundledScout = bundledOnly.agents.find((agent) => agent.name === "scout");
		const bundledCoordinator = bundledOnly.agents.find((agent) => agent.name === "coordinator");
		assert.ok(bundledScout, "bundled scout agent should be discovered");
		assert.ok(bundledCoordinator, "bundled coordinator agent should be discovered");
		assert.equal(bundledScout.source, "package");
		assert.equal(bundledCoordinator.source, "package");

		fs.writeFileSync(
			path.join(userAgentsDir, "scout.md"),
			"---\nname: scout\ndescription: User scout override\n---\n\nUser override.",
		);
		const withUserOverride = discoverAgents(projectRootDir, "user");
		assert.equal(withUserOverride.agents.find((agent) => agent.name === "scout")?.source, "user");

		fs.writeFileSync(
			path.join(projectAgentsDir, "scout.md"),
			"---\nname: scout\ndescription: Project scout override\n---\n\nProject override.",
		);
		const withProjectOverride = discoverAgents(path.join(projectRootDir, "src"), "both");
		assert.equal(withProjectOverride.agents.find((agent) => agent.name === "scout")?.source, "project");
	} finally {
		if (previousAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
		else process.env.PI_CODING_AGENT_DIR = previousAgentDir;
		fs.rmSync(tmpDir, { recursive: true, force: true });
	}
});
