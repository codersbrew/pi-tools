import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "@mariozechner/jiti";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

function createPiStyleJiti() {
	return createJiti(import.meta.url, {
		moduleCache: false,
		alias: {
			"@mariozechner/pi-coding-agent": path.join(projectRoot, "node_modules/@mariozechner/pi-coding-agent/dist/index.js"),
			"@mariozechner/pi-tui": path.join(projectRoot, "node_modules/@mariozechner/pi-tui/dist/index.js"),
		},
	});
}

async function loadModule() {
	const jiti = createPiStyleJiti();
	return jiti.import(path.join(projectRoot, "extensions/update-pi.ts"));
}

test("update-pi extension loads through pi's extension loader aliases", async () => {
	const mod = await loadModule();
	assert.equal(typeof mod.default, "function");
});

test("buildPiUpdateCommand prefers configured npmCommand", async () => {
	const { buildPiUpdateCommand } = await loadModule();
	const command = buildPiUpdateCommand({
		npmCommand: ["mise", "exec", "node@20", "--", "npm"],
		installMethod: "yarn",
	});

	assert.deepEqual(command, {
		command: "mise",
		args: ["exec", "node@20", "--", "npm", "install", "-g", "@mariozechner/pi-coding-agent"],
		display: "mise exec node@20 -- npm install -g @mariozechner/pi-coding-agent",
		method: "npmCommand",
	});
});

test("buildPiUpdateCommand maps install methods to package-manager commands", async () => {
	const { buildPiUpdateCommand } = await loadModule();

	assert.deepEqual(buildPiUpdateCommand({ installMethod: "pnpm" }), {
		command: "pnpm",
		args: ["install", "-g", "@mariozechner/pi-coding-agent"],
		display: "pnpm install -g @mariozechner/pi-coding-agent",
		method: "pnpm",
	});

	assert.deepEqual(buildPiUpdateCommand({ installMethod: "yarn" }), {
		command: "yarn",
		args: ["global", "add", "@mariozechner/pi-coding-agent"],
		display: "yarn global add @mariozechner/pi-coding-agent",
		method: "yarn",
	});

	assert.deepEqual(buildPiUpdateCommand({ installMethod: "bun" }), {
		command: "bun",
		args: ["install", "-g", "@mariozechner/pi-coding-agent"],
		display: "bun install -g @mariozechner/pi-coding-agent",
		method: "bun",
	});
});

test("detectInstallMethodFromPaths recognizes common install layouts", async () => {
	const { detectInstallMethodFromPaths } = await loadModule();

	assert.equal(detectInstallMethodFromPaths("/Users/me/.pnpm/global/5/node_modules/pi\0/usr/local/bin/node", false), "pnpm");
	assert.equal(detectInstallMethodFromPaths("/Users/me/.yarn/bin/pi\0/usr/local/bin/node", false), "yarn");
	assert.equal(detectInstallMethodFromPaths("/Users/me/project/node_modules/@mariozechner/pi-coding-agent/dist/cli.js\0/usr/local/bin/node", false), "npm");
	assert.equal(detectInstallMethodFromPaths("/tmp/pi\0/usr/local/bin/bun", true), "bun");
	assert.equal(detectInstallMethodFromPaths("/tmp/pi\0/usr/local/bin/node", false), "unknown");
});

test("getPiAgentDir respects PI_CODING_AGENT_DIR and home expansion", async () => {
	const { getPiAgentDir } = await loadModule();

	assert.equal(getPiAgentDir({}, "/Users/test"), "/Users/test/.pi/agent");
	assert.equal(getPiAgentDir({ PI_CODING_AGENT_DIR: "~/custom-agent" }, "/Users/test"), "/Users/test/custom-agent");
	assert.equal(getPiAgentDir({ PI_CODING_AGENT_DIR: "/tmp/pi-agent" }, "/Users/test"), "/tmp/pi-agent");
});
