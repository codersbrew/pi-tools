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
const bundledImplementPromptPath = path.join(projectRoot, "extensions/subagent/prompts/implement.md");

function readPackageJson() {
	return JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
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
	assert.ok(fs.existsSync(bundledImplementPromptPath), "extensions/subagent/prompts/implement.md should exist");
});

test("subagent loads through pi's extension loader aliases", async () => {
	const jiti = createPiStyleJiti();
	const factory = await jiti.import(subagentIndexPath, { default: true });
	assert.equal(typeof factory, "function");
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
		assert.ok(bundledScout, "bundled scout agent should be discovered");
		assert.equal(bundledScout.source, "package");

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
