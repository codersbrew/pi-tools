import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const packageJsonPath = path.join(projectRoot, "package.json");
const skillPath = path.join(projectRoot, "skills/plan/SKILL.md");

function readPackageJson() {
	return JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
}

test("package publishes the plan skill with pi metadata", () => {
	const pkg = readPackageJson();

	assert.ok(pkg.files.includes("skills"), "package.json files should include skills");
	assert.ok(pkg.pi?.skills?.includes("./skills"), "package.json pi.skills should include ./skills");
	assert.ok(fs.existsSync(skillPath), "skills/plan/SKILL.md should exist");

	const skill = fs.readFileSync(skillPath, "utf8");
	assert.match(
		skill,
		/^---\nname: plan\ndescription: Use when the user wants \/skill:plan to perform the bundled \/plan workflow directly in the current conversation context, without delegating to the subagent tool\.\n---/m,
	);
	assert.match(skill, /Do \*\*not\*\* use the `subagent` tool\./);
	assert.match(skill, /## Final Response Format/);
});
