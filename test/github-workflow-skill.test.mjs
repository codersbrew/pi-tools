import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const packageJsonPath = path.join(projectRoot, "package.json");
const skillPath = path.join(projectRoot, "skills/github-workflow/SKILL.md");

function readPackageJson() {
	return JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
}

test("package publishes the github-workflow skill with pi metadata", () => {
	const pkg = readPackageJson();

	assert.ok(pkg.files.includes("skills"), "package.json files should include skills");
	assert.ok(pkg.pi?.skills?.includes("./skills"), "package.json pi.skills should include ./skills");
	assert.ok(fs.existsSync(skillPath), "skills/github-workflow/SKILL.md should exist");

	const skill = fs.readFileSync(skillPath, "utf8");
	assert.match(skill, /^---\nname: github-workflow\ndescription: Use when .+\n---/m);
});
