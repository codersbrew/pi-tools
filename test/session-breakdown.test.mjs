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

test("session-breakdown loads through pi's extension loader aliases", async () => {
	const jiti = createPiStyleJiti();
	const factory = await jiti.import(path.join(projectRoot, "extensions/session-breakdown.ts"), { default: true });
	assert.equal(typeof factory, "function");
});
