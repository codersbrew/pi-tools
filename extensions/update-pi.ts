import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { SettingsManager } from "@mariozechner/pi-coding-agent";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { existsSync, readFileSync } from "node:fs";

export const PI_PACKAGE_NAME = "@mariozechner/pi-coding-agent";
const VERSION_CHECK_TIMEOUT_MS = 10_000;
const UPDATE_TIMEOUT_MS = 5 * 60_000;

export type InstallMethod = "npm" | "pnpm" | "yarn" | "bun" | "unknown";

export interface UpdateCommandSpec {
	command: string;
	args: string[];
	display: string;
	method: InstallMethod | "npmCommand";
}

function shellQuote(arg: string): string {
	return /^[A-Za-z0-9_./:@=-]+$/.test(arg) ? arg : JSON.stringify(arg);
}

function formatCommand(command: string, args: string[]): string {
	return [command, ...args].map(shellQuote).join(" ");
}

export function detectInstallMethodFromPaths(resolvedPath: string, isBunRuntime: boolean): InstallMethod {
	const value = resolvedPath.toLowerCase();
	if (value.includes("/pnpm/") || value.includes("/.pnpm/") || value.includes("\\pnpm\\")) {
		return "pnpm";
	}
	if (value.includes("/yarn/") || value.includes("/.yarn/") || value.includes("\\yarn\\")) {
		return "yarn";
	}
	if (isBunRuntime) {
		return "bun";
	}
	if (value.includes("/npm/") || value.includes("/node_modules/") || value.includes("\\npm\\")) {
		return "npm";
	}
	return "unknown";
}

export function detectInstallMethod(): InstallMethod {
	const resolvedPath = `${process.argv[1] ?? ""}\0${process.execPath ?? ""}`;
	return detectInstallMethodFromPaths(resolvedPath, Boolean(process.versions.bun));
}

export function getPiAgentDir(env: NodeJS.ProcessEnv = process.env, homeDir = os.homedir()): string {
	const configured = env.PI_CODING_AGENT_DIR?.trim();
	if (!configured) {
		return path.join(homeDir, ".pi", "agent");
	}
	if (configured === "~") {
		return homeDir;
	}
	if (configured.startsWith("~/")) {
		return path.join(homeDir, configured.slice(2));
	}
	return configured;
}

export function getConfiguredNpmCommand(cwd: string, agentDir = getPiAgentDir()): string[] | undefined {
	try {
		const settingsManager = SettingsManager.create(cwd, agentDir);
		const npmCommand = settingsManager.getNpmCommand();
		return npmCommand && npmCommand.length > 0 ? npmCommand : undefined;
	} catch {
		return undefined;
	}
}

export function buildPiUpdateCommand(options?: {
	npmCommand?: string[];
	installMethod?: InstallMethod;
}): UpdateCommandSpec {
	const npmCommand = options?.npmCommand?.filter(Boolean);
	if (npmCommand && npmCommand.length > 0) {
		const [command, ...args] = npmCommand;
		return {
			command,
			args: [...args, "install", "-g", PI_PACKAGE_NAME],
			display: formatCommand(command, [...args, "install", "-g", PI_PACKAGE_NAME]),
			method: "npmCommand",
		};
	}

	const installMethod = options?.installMethod ?? detectInstallMethod();
	switch (installMethod) {
		case "pnpm":
			return {
				command: "pnpm",
				args: ["install", "-g", PI_PACKAGE_NAME],
				display: formatCommand("pnpm", ["install", "-g", PI_PACKAGE_NAME]),
				method: "pnpm",
			};
		case "yarn":
			return {
				command: "yarn",
				args: ["global", "add", PI_PACKAGE_NAME],
				display: formatCommand("yarn", ["global", "add", PI_PACKAGE_NAME]),
				method: "yarn",
			};
		case "bun":
			return {
				command: "bun",
				args: ["install", "-g", PI_PACKAGE_NAME],
				display: formatCommand("bun", ["install", "-g", PI_PACKAGE_NAME]),
				method: "bun",
			};
		case "npm":
		case "unknown":
		default:
			return {
				command: "npm",
				args: ["install", "-g", PI_PACKAGE_NAME],
				display: formatCommand("npm", ["install", "-g", PI_PACKAGE_NAME]),
				method: installMethod,
			};
	}
}

function getPiPackageRoot(): string | undefined {
	try {
		const require = createRequire(import.meta.url);
		let current = path.dirname(require.resolve(PI_PACKAGE_NAME));
		while (true) {
			const packageJsonPath = path.join(current, "package.json");
			if (existsSync(packageJsonPath)) {
				const parsed = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { name?: string };
				if (parsed.name === PI_PACKAGE_NAME) {
					return current;
				}
			}
			const parent = path.dirname(current);
			if (parent === current) {
				return undefined;
			}
			current = parent;
		}
	} catch {
		return undefined;
	}
}

export function getInstalledPiVersion(): string | undefined {
	const packageRoot = getPiPackageRoot();
	if (!packageRoot) {
		return undefined;
	}
	try {
		const packageJsonPath = path.join(packageRoot, "package.json");
		const parsed = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { version?: string };
		return parsed.version;
	} catch {
		return undefined;
	}
}

export async function getLatestPiVersion(fetchImpl: typeof fetch = fetch): Promise<string> {
	const response = await fetchImpl(`https://registry.npmjs.org/${PI_PACKAGE_NAME}/latest`, {
		headers: {
			accept: "application/json",
		},
		signal: AbortSignal.timeout(VERSION_CHECK_TIMEOUT_MS),
	});
	if (!response.ok) {
		throw new Error(`Version check failed with status ${response.status}`);
	}
	const data = (await response.json()) as { version?: string };
	if (!data.version) {
		throw new Error("npm registry did not return a version");
	}
	return data.version;
}

function parseCommandFlags(args: string | undefined): { yes: boolean } {
	const flags = new Set((args ?? "").split(/\s+/).filter(Boolean));
	return {
		yes: flags.has("--yes") || flags.has("-y"),
	};
}

function buildConfirmBody(currentVersion: string | undefined, latestVersion: string | undefined, command: UpdateCommandSpec): string {
	const lines = [
		currentVersion ? `Current version: ${currentVersion}` : undefined,
		latestVersion ? `Latest version: ${latestVersion}` : undefined,
		`Command: ${command.display}`,
		"",
		"pi will need to be restarted after the update finishes.",
	].filter((line): line is string => Boolean(line));
	return lines.join("\n");
}

function formatExecFailure(stdout: string, stderr: string): string {
	const output = [stderr.trim(), stdout.trim()].filter(Boolean).join("\n\n").trim();
	if (!output) {
		return "No output.";
	}
	return output.length > 1200 ? `${output.slice(0, 1200)}…` : output;
}

export default function (pi: ExtensionAPI) {
	pi.registerCommand("update-pi", {
		description: "Update the pi CLI package and remind you to restart",
		handler: async (args, ctx) => {
			await ctx.waitForIdle();

			const { yes } = parseCommandFlags(args);
			const currentVersion = getInstalledPiVersion();

			let latestVersion: string | undefined;
			let versionCheckError: string | undefined;
			try {
				latestVersion = await getLatestPiVersion();
			} catch (error) {
				versionCheckError = error instanceof Error ? error.message : String(error);
			}

			if (latestVersion && currentVersion && latestVersion === currentVersion) {
				if (ctx.hasUI) {
					ctx.ui.notify(`pi is already up to date (${currentVersion}).`, "info");
				}
				return;
			}

			const npmCommand = getConfiguredNpmCommand(ctx.cwd);
			const command = buildPiUpdateCommand({ npmCommand });

			if (!yes) {
				if (!ctx.hasUI) {
					throw new Error(`No interactive UI available. Re-run with /update-pi --yes or manually run: ${command.display}`);
				}
				const title = latestVersion ? "Update pi" : "Update pi without version check?";
				const message = latestVersion
					? buildConfirmBody(currentVersion, latestVersion, command)
					: `${versionCheckError ?? "Unable to check the latest version."}\n\n${buildConfirmBody(currentVersion, latestVersion, command)}`;
				const ok = await ctx.ui.confirm(title, message);
				if (!ok) {
					return;
				}
			}

			if (ctx.hasUI) {
				ctx.ui.setStatus("update-pi", `Updating pi via ${command.display}`);
				ctx.ui.notify("Updating pi…", "info");
			}

			try {
				const result = await pi.exec(command.command, command.args, {
					cwd: ctx.cwd,
					timeout: UPDATE_TIMEOUT_MS,
				});

				if (result.code !== 0) {
					throw new Error(`Update command failed (exit ${result.code}).\n\n${formatExecFailure(result.stdout, result.stderr)}`);
				}

				const updatedVersion = getInstalledPiVersion();
				if (ctx.hasUI) {
					const updatedLabel = updatedVersion && updatedVersion !== currentVersion
						? `Updated pi to ${updatedVersion}.`
						: latestVersion
							? `Update command completed for pi ${latestVersion}.`
							: "Update command completed.";
					ctx.ui.notify(`${updatedLabel} Restart pi to use the new version.`, "info");
				}
			} finally {
				if (ctx.hasUI) {
					ctx.ui.setStatus("update-pi", undefined);
				}
			}
		},
	});
}
