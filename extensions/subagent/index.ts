/**
 * Subagent Tool - Delegate tasks to specialized agents
 *
 * Spawns a separate `pi` process for each subagent invocation,
 * giving it an isolated context window.
 *
 * Supports three modes:
 *   - Single: { agent: "name", task: "..." }
 *   - Parallel: { tasks: [{ agent: "name", task: "..." }, ...] }
 *   - Chain: { chain: [{ agent: "name", task: "... {previous} ..." }, ...] }
 *
 * Uses JSON mode to capture structured output from subagents.
 */

import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { AgentToolResult } from "@mariozechner/pi-agent-core";
import type { Message } from "@mariozechner/pi-ai";
import { StringEnum } from "@mariozechner/pi-ai";
import { type ExtensionAPI, getMarkdownTheme } from "@mariozechner/pi-coding-agent";
import { Container, Markdown, Spacer, Text } from "@mariozechner/pi-tui";
import { Type } from "@sinclair/typebox";
import { type AgentConfig, type AgentScope, discoverAgents } from "./agents.js";

const MAX_PARALLEL_TASKS = 8;
const MAX_CONCURRENCY = 4;
const COLLAPSED_ITEM_COUNT = 10;

const ICONS = {
	success: "●",
	error: "✕",
	running: "◔",
	partial: "◐",
	toolCall: "›",
} as const;

function formatTokens(count: number): string {
	if (count < 1000) return count.toString();
	if (count < 10000) return `${(count / 1000).toFixed(1)}k`;
	if (count < 1000000) return `${Math.round(count / 1000)}k`;
	return `${(count / 1000000).toFixed(1)}M`;
}

function formatUsageStats(
	usage: {
		input: number;
		output: number;
		cacheRead: number;
		cacheWrite: number;
		cost: number;
		contextTokens?: number;
		turns?: number;
	},
	model?: string,
): string {
	const parts: string[] = [];
	if (usage.turns) parts.push(`${usage.turns} turn${usage.turns > 1 ? "s" : ""}`);
	if (usage.input) parts.push(`↑${formatTokens(usage.input)}`);
	if (usage.output) parts.push(`↓${formatTokens(usage.output)}`);
	if (usage.cacheRead) parts.push(`R${formatTokens(usage.cacheRead)}`);
	if (usage.cacheWrite) parts.push(`W${formatTokens(usage.cacheWrite)}`);
	if (usage.cost) parts.push(`$${usage.cost.toFixed(4)}`);
	if (usage.contextTokens && usage.contextTokens > 0) {
		parts.push(`ctx:${formatTokens(usage.contextTokens)}`);
	}
	if (model) parts.push(model);
	return parts.join(" ");
}

function formatToolCall(
	toolName: string,
	args: Record<string, unknown>,
	themeFg: (color: any, text: string) => string,
): string {
	const shortenPath = (p: string) => {
		const home = os.homedir();
		return p.startsWith(home) ? `~${p.slice(home.length)}` : p;
	};

	switch (toolName) {
		case "bash": {
			const command = (args.command as string) || "...";
			const preview = command.length > 60 ? `${command.slice(0, 60)}...` : command;
			return themeFg("muted", "$ ") + themeFg("toolOutput", preview);
		}
		case "read": {
			const rawPath = (args.file_path || args.path || "...") as string;
			const filePath = shortenPath(rawPath);
			const offset = args.offset as number | undefined;
			const limit = args.limit as number | undefined;
			let text = themeFg("accent", filePath);
			if (offset !== undefined || limit !== undefined) {
				const startLine = offset ?? 1;
				const endLine = limit !== undefined ? startLine + limit - 1 : "";
				text += themeFg("warning", `:${startLine}${endLine ? `-${endLine}` : ""}`);
			}
			return themeFg("muted", "read ") + text;
		}
		case "write": {
			const rawPath = (args.file_path || args.path || "...") as string;
			const filePath = shortenPath(rawPath);
			const content = (args.content || "") as string;
			const lines = content.split("\n").length;
			let text = themeFg("muted", "write ") + themeFg("accent", filePath);
			if (lines > 1) text += themeFg("dim", ` (${lines} lines)`);
			return text;
		}
		case "edit": {
			const rawPath = (args.file_path || args.path || "...") as string;
			return themeFg("muted", "edit ") + themeFg("accent", shortenPath(rawPath));
		}
		case "ls": {
			const rawPath = (args.path || ".") as string;
			return themeFg("muted", "ls ") + themeFg("accent", shortenPath(rawPath));
		}
		case "find": {
			const pattern = (args.pattern || "*") as string;
			const rawPath = (args.path || ".") as string;
			return themeFg("muted", "find ") + themeFg("accent", pattern) + themeFg("dim", ` in ${shortenPath(rawPath)}`);
		}
		case "grep": {
			const pattern = (args.pattern || "") as string;
			const rawPath = (args.path || ".") as string;
			return (
				themeFg("muted", "grep ") +
				themeFg("accent", `/${pattern}/`) +
				themeFg("dim", ` in ${shortenPath(rawPath)}`)
			);
		}
		default: {
			const argsStr = JSON.stringify(args);
			const preview = argsStr.length > 50 ? `${argsStr.slice(0, 50)}...` : argsStr;
			return themeFg("accent", toolName) + themeFg("dim", ` ${preview}`);
		}
	}
}

const MAX_CHAIN_PREVIOUS_OUTPUT_CHARS = 20_000;
const RUNNING_EXIT_CODE = -1;
const OUTPUT_PREVIEW_CHARS = 100;

type DisplayItem = { type: "text"; text: string } | { type: "toolCall"; name: string; args: Record<string, any> };

interface UsageStats {
	input: number;
	output: number;
	cacheRead: number;
	cacheWrite: number;
	cost: number;
	contextTokens: number;
	turns: number;
}

interface SingleResult {
	agent: string;
	agentSource: "package" | "user" | "project" | "unknown";
	task: string;
	exitCode: number;
	displayItems: DisplayItem[];
	finalOutput: string;
	stderr: string;
	usage: UsageStats;
	model?: string;
	stopReason?: string;
	errorMessage?: string;
	step?: number;
}

interface SubagentDetails {
	mode: "single" | "parallel" | "chain";
	agentScope: AgentScope;
	projectAgentsDir: string | null;
	results: SingleResult[];
}

function isRunningResult(result: SingleResult): boolean {
	return result.exitCode === RUNNING_EXIT_CODE;
}

function isErrorResult(result: SingleResult): boolean {
	return !isRunningResult(result) && (result.exitCode !== 0 || result.stopReason === "error" || result.stopReason === "aborted");
}

function getDisplayItemsFromMessage(message: Message): DisplayItem[] {
	if (message.role !== "assistant") return [];
	const items: DisplayItem[] = [];
	for (const part of message.content) {
		if (part.type === "text") items.push({ type: "text", text: part.text });
		else if (part.type === "toolCall") items.push({ type: "toolCall", name: part.name, args: part.arguments });
	}
	return items;
}

function getFinalOutputFromMessage(message: Message): string {
	if (message.role !== "assistant") return "";
	return message.content
		.filter((part): part is Extract<Message["content"][number], { type: "text" }> => part.type === "text")
		.map((part) => part.text)
		.join("\n\n")
		.trim();
}

function clampPreviousOutput(text: string, maxChars = MAX_CHAIN_PREVIOUS_OUTPUT_CHARS): string {
	if (text.length <= maxChars) return text;
	const head = Math.ceil(maxChars / 2);
	const tail = Math.floor(maxChars / 2);
	const omitted = text.length - head - tail;
	return `${text.slice(0, head)}\n\n...[truncated ${omitted} chars before passing to next chain step]...\n\n${text.slice(text.length - tail)}`;
}

function getOutputPreview(text: string, maxChars = OUTPUT_PREVIEW_CHARS): string {
	return text.length > maxChars ? `${text.slice(0, maxChars)}...` : text;
}

function aggregateUsage(results: SingleResult[]) {
	const total = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, turns: 0 };
	for (const result of results) {
		total.input += result.usage.input;
		total.output += result.usage.output;
		total.cacheRead += result.usage.cacheRead;
		total.cacheWrite += result.usage.cacheWrite;
		total.cost += result.usage.cost;
		total.turns += result.usage.turns;
	}
	return total;
}

async function mapWithConcurrencyLimit<TIn, TOut>(
	items: TIn[],
	concurrency: number,
	signal: AbortSignal | undefined,
	fn: (item: TIn, index: number) => Promise<TOut>,
): Promise<TOut[]> {
	if (items.length === 0) return [];
	const limit = Math.max(1, Math.min(concurrency, items.length));
	const results: TOut[] = new Array(items.length);
	let nextIndex = 0;
	const workers = new Array(limit).fill(null).map(async () => {
		while (true) {
			if (signal?.aborted) throw new Error("Subagent was aborted");
			const current = nextIndex++;
			if (current >= items.length) return;
			if (signal?.aborted) throw new Error("Subagent was aborted");
			results[current] = await fn(items[current], current);
		}
	});
	await Promise.all(workers);
	return results;
}

function getSafeAgentName(agentName: string): string {
	return agentName.replace(/[^\w.-]+/g, "_");
}

async function createTempAgentRunDir(agentName: string): Promise<string> {
	return fs.promises.mkdtemp(path.join(os.tmpdir(), `pi-subagent-${getSafeAgentName(agentName)}-`));
}

async function writeTempTextFile(dir: string, fileName: string, content: string): Promise<string> {
	const filePath = path.join(dir, fileName);
	await fs.promises.writeFile(filePath, content, { encoding: "utf-8", mode: 0o600 });
	return filePath;
}

function getPiInvocation(args: string[]): { command: string; args: string[] } {
	const currentScript = process.argv[1];
	if (currentScript && fs.existsSync(currentScript)) {
		return { command: process.execPath, args: [currentScript, ...args] };
	}

	const execName = path.basename(process.execPath).toLowerCase();
	const isGenericRuntime = /^(node|bun)(\.exe)?$/.test(execName);
	if (!isGenericRuntime) {
		return { command: process.execPath, args };
	}

	return { command: "pi", args };
}

type OnUpdateCallback = (partial: AgentToolResult<SubagentDetails>) => void;

type AvailableModelLike = {
	id: string;
	provider: string;
};

export function resolvePreferredModel(
	modelPreference: string | undefined,
	availableModels: AvailableModelLike[],
	currentProvider?: string,
): string | undefined {
	if (!modelPreference) return undefined;
	const candidates = modelPreference
		.split(",")
		.map((model) => model.trim())
		.filter(Boolean);
	if (candidates.length === 0) return undefined;

	const normalizedCurrentProvider = currentProvider?.toLowerCase();

	for (const candidate of candidates) {
		const slashIndex = candidate.indexOf("/");
		if (slashIndex !== -1) {
			const provider = candidate.slice(0, slashIndex).trim();
			const modelId = candidate.slice(slashIndex + 1).trim();
			const match = availableModels.find(
				(model) =>
					model.provider.toLowerCase() === provider.toLowerCase() && model.id.toLowerCase() === modelId.toLowerCase(),
			);
			if (match) return `${match.provider}/${match.id}`;
			continue;
		}

		const matches = availableModels.filter((model) => model.id.toLowerCase() === candidate.toLowerCase());
		if (matches.length === 0) continue;
		const preferredMatch =
			matches.find((model) => model.provider.toLowerCase() === normalizedCurrentProvider) ?? matches[0];
		return `${preferredMatch.provider}/${preferredMatch.id}`;
	}

	return undefined;
}

function formatAvailableModels(availableModels: AvailableModelLike[], maxItems = 8): string {
	if (availableModels.length === 0) return "none";
	const listed = availableModels.slice(0, maxItems).map((model) => `${model.provider}/${model.id}`);
	if (availableModels.length <= maxItems) return listed.join(", ");
	return `${listed.join(", ")} (+${availableModels.length - maxItems} more)`;
}

function getAgentRunInfo(
	agentByName: ReadonlyMap<string, AgentConfig>,
	availableModels: AvailableModelLike[],
	currentProvider: string | undefined,
	agentName: string,
): { agent: AgentConfig | undefined; resolvedModel: string | undefined; modelResolutionError?: string } {
	const agent = agentByName.get(agentName);
	const resolvedModel = resolvePreferredModel(agent?.model, availableModels, currentProvider);
	const modelResolutionError =
		agent?.model && !resolvedModel
			? `No preferred model available for agent "${agentName}". Requested: ${agent.model}. Available: ${formatAvailableModels(availableModels)}.`
			: undefined;
	return { agent, resolvedModel, modelResolutionError };
}

async function runSingleAgent(
	defaultCwd: string,
	agents: AgentConfig[],
	agentByName: ReadonlyMap<string, AgentConfig>,
	availableModels: AvailableModelLike[],
	currentProvider: string | undefined,
	agentName: string,
	task: string,
	cwd: string | undefined,
	step: number | undefined,
	signal: AbortSignal | undefined,
	onUpdate: OnUpdateCallback | undefined,
	makeDetails: (results: SingleResult[]) => SubagentDetails,
): Promise<SingleResult> {
	const { agent, resolvedModel, modelResolutionError } = getAgentRunInfo(
		agentByName,
		availableModels,
		currentProvider,
		agentName,
	);

	if (!agent) {
		const available = agents.map((a) => `"${a.name}"`).join(", ") || "none";
		return {
			agent: agentName,
			agentSource: "unknown",
			task,
			exitCode: 1,
			displayItems: [],
			finalOutput: "",
			stderr: `Unknown agent: "${agentName}". Available agents: ${available}.`,
			usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, contextTokens: 0, turns: 0 },
			model: resolvedModel,
			step,
		};
	}

	if (modelResolutionError) {
		return {
			agent: agentName,
			agentSource: agent.source,
			task,
			exitCode: 1,
			displayItems: [],
			finalOutput: "",
			stderr: modelResolutionError,
			usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, contextTokens: 0, turns: 0 },
			model: agent.model,
			errorMessage: modelResolutionError,
			step,
		};
	}

	const args: string[] = ["--mode", "json", "-p", "--no-session"];
	if (resolvedModel) args.push("--model", resolvedModel);
	if (agent.tools && agent.tools.length > 0) args.push("--tools", agent.tools.join(","));

	let tmpDir: string | null = null;
	const ensureTmpDir = async () => {
		if (!tmpDir) tmpDir = await createTempAgentRunDir(agent.name);
		return tmpDir;
	};

	const currentResult: SingleResult = {
		agent: agentName,
		agentSource: agent.source,
		task,
		exitCode: RUNNING_EXIT_CODE,
		displayItems: [],
		finalOutput: "",
		stderr: "",
		usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, contextTokens: 0, turns: 0 },
		model: resolvedModel,
		step,
	};

	const emitUpdate = () => {
		if (onUpdate) {
			onUpdate({
				content: [{ type: "text", text: currentResult.finalOutput || "(running...)" }],
				details: makeDetails([currentResult]),
			});
		}
	};

	try {
		if (agent.systemPrompt.trim()) {
			const systemPromptPath = await writeTempTextFile(
				await ensureTmpDir(),
				`system-${getSafeAgentName(agent.name)}.md`,
				agent.systemPrompt,
			);
			args.push("--append-system-prompt", systemPromptPath);
		}

		const taskPath = await writeTempTextFile(
			await ensureTmpDir(),
			`task-${getSafeAgentName(agent.name)}.md`,
			`Task: ${task}`,
		);
		args.push(`@${taskPath}`);
		let wasAborted = false;
		emitUpdate();

		const exitCode = await new Promise<number>((resolve) => {
			const invocation = getPiInvocation(args);
			const proc = spawn(invocation.command, invocation.args, {
				cwd: cwd ?? defaultCwd,
				shell: false,
				stdio: ["ignore", "pipe", "pipe"],
			});
			let buffer = "";
			let closed = false;
			let forceKillTimeout: NodeJS.Timeout | undefined;
			let abortHandler: (() => void) | undefined;

			const cleanupProcessListeners = () => {
				closed = true;
				if (forceKillTimeout) {
					clearTimeout(forceKillTimeout);
					forceKillTimeout = undefined;
				}
				if (signal && abortHandler) {
					signal.removeEventListener("abort", abortHandler);
					abortHandler = undefined;
				}
			};

			const processLine = (line: string) => {
				if (!line.trim()) return;
				let event: any;
				try {
					event = JSON.parse(line);
				} catch {
					return;
				}

				if (event.type === "message_end" && event.message) {
					const msg = event.message as Message;
					if (msg.role !== "assistant") return;

					currentResult.usage.turns++;
					const usage = msg.usage;
					if (usage) {
						currentResult.usage.input += usage.input || 0;
						currentResult.usage.output += usage.output || 0;
						currentResult.usage.cacheRead += usage.cacheRead || 0;
						currentResult.usage.cacheWrite += usage.cacheWrite || 0;
						currentResult.usage.cost += usage.cost?.total || 0;
						currentResult.usage.contextTokens = usage.totalTokens || 0;
					}
					currentResult.displayItems.push(...getDisplayItemsFromMessage(msg));
					const finalOutput = getFinalOutputFromMessage(msg);
					if (finalOutput) currentResult.finalOutput = finalOutput;
					if (!currentResult.model && msg.model) currentResult.model = msg.model;
					if (msg.stopReason) currentResult.stopReason = msg.stopReason;
					if (msg.errorMessage) currentResult.errorMessage = msg.errorMessage;
					emitUpdate();
				}
			};

			proc.stdout.on("data", (data) => {
				buffer += data.toString();
				const lines = buffer.split("\n");
				buffer = lines.pop() || "";
				for (const line of lines) processLine(line);
			});

			proc.stderr.on("data", (data) => {
				currentResult.stderr += data.toString();
			});

			proc.on("close", (code) => {
				cleanupProcessListeners();
				if (buffer.trim()) processLine(buffer);
				resolve(code ?? 0);
			});

			proc.on("error", () => {
				cleanupProcessListeners();
				resolve(1);
			});

			if (signal) {
				abortHandler = () => {
					wasAborted = true;
					proc.kill("SIGTERM");
					forceKillTimeout = setTimeout(() => {
						if (!closed) proc.kill("SIGKILL");
					}, 5000);
				};
				if (signal.aborted) abortHandler();
				else signal.addEventListener("abort", abortHandler, { once: true });
			}
		});

		currentResult.exitCode = exitCode;
		if (wasAborted) throw new Error("Subagent was aborted");
		return currentResult;
	} finally {
		if (tmpDir) {
			await fs.promises.rm(tmpDir, { recursive: true, force: true });
		}
	}
}

const TaskItem = Type.Object({
	agent: Type.String({ description: "Name of the agent to invoke" }),
	task: Type.String({ description: "Task to delegate to the agent" }),
	cwd: Type.Optional(Type.String({ description: "Working directory for the agent process" })),
});

const ChainItem = Type.Object({
	agent: Type.String({ description: "Name of the agent to invoke" }),
	task: Type.String({ description: "Task with optional {previous} placeholder for prior output" }),
	cwd: Type.Optional(Type.String({ description: "Working directory for the agent process" })),
});

const AgentScopeSchema = StringEnum(["user", "project", "both"] as const, {
	description: 'Which agent directories to use. Default: "user". Use "both" to include project-local agents.',
	default: "user",
});

const SubagentParams = Type.Object({
	agent: Type.Optional(Type.String({ description: "Name of the agent to invoke (for single mode)" })),
	task: Type.Optional(Type.String({ description: "Task to delegate (for single mode)" })),
	tasks: Type.Optional(Type.Array(TaskItem, { description: "Array of {agent, task} for parallel execution" })),
	chain: Type.Optional(Type.Array(ChainItem, { description: "Array of {agent, task} for sequential execution" })),
	agentScope: Type.Optional(AgentScopeSchema),
	confirmProjectAgents: Type.Optional(
		Type.Boolean({ description: "Prompt before running project-local agents. Default: true.", default: true }),
	),
	cwd: Type.Optional(Type.String({ description: "Working directory for the agent process (single mode)" })),
});

export default function (pi: ExtensionAPI) {
	pi.registerTool({
		name: "subagent",
		label: "Subagent",
		description: [
			"Delegate tasks to specialized subagents with isolated context.",
			"Modes: single (agent + task), parallel (tasks array), chain (sequential with {previous} placeholder).",
			'Default agent scope is "user" (from ~/.pi/agent/agents).',
			'To enable project-local agents in .pi/agents, set agentScope: "both" (or "project").',
		].join(" "),
		parameters: SubagentParams,

		async execute(_toolCallId, params, signal, onUpdate, ctx) {
			const agentScope: AgentScope = params.agentScope ?? "user";
			const discovery = discoverAgents(ctx.cwd, agentScope);
			const agents = discovery.agents;
			const agentByName = new Map(agents.map((agent) => [agent.name, agent] as const));
			const availableModels = ctx.modelRegistry.getAvailable().map((model) => ({
				id: model.id,
				provider: model.provider,
			}));
			const currentProvider = ctx.model?.provider;
			const confirmProjectAgents = params.confirmProjectAgents ?? true;

			const hasChain = (params.chain?.length ?? 0) > 0;
			const hasTasks = (params.tasks?.length ?? 0) > 0;
			const hasSingle = Boolean(params.agent && params.task);
			const modeCount = Number(hasChain) + Number(hasTasks) + Number(hasSingle);

			const makeDetails =
				(mode: "single" | "parallel" | "chain") =>
				(results: SingleResult[]): SubagentDetails => ({
					mode,
					agentScope,
					projectAgentsDir: discovery.projectAgentsDir,
					results,
				});

			if (modeCount !== 1) {
				const available = agents.map((a) => `${a.name} (${a.source})`).join(", ") || "none";
				return {
					content: [
						{
							type: "text",
							text: `Invalid parameters. Provide exactly one mode.\nAvailable agents: ${available}`,
						},
					],
					details: makeDetails("single")([]),
				};
			}

			if ((agentScope === "project" || agentScope === "both") && confirmProjectAgents && ctx.hasUI) {
				const requestedAgentNames = new Set<string>();
				if (params.chain) for (const step of params.chain) requestedAgentNames.add(step.agent);
				if (params.tasks) for (const t of params.tasks) requestedAgentNames.add(t.agent);
				if (params.agent) requestedAgentNames.add(params.agent);

				const projectAgentsRequested = Array.from(requestedAgentNames)
					.map((name) => agentByName.get(name))
					.filter((a): a is AgentConfig => a?.source === "project");

				if (projectAgentsRequested.length > 0) {
					const names = projectAgentsRequested.map((a) => a.name).join(", ");
					const dir = discovery.projectAgentsDir ?? "(unknown)";
					const ok = await ctx.ui.confirm(
						"Run project-local agents?",
						`Agents: ${names}\nSource: ${dir}\n\nProject agents are repo-controlled. Only continue for trusted repositories.`,
					);
					if (!ok)
						return {
							content: [{ type: "text", text: "Canceled: project-local agents not approved." }],
							details: makeDetails(hasChain ? "chain" : hasTasks ? "parallel" : "single")([]),
						};
				}
			}

			if (params.chain && params.chain.length > 0) {
				const results: SingleResult[] = [];
				let previousOutput = "";

				for (let i = 0; i < params.chain.length; i++) {
					const step = params.chain[i];
					const taskWithContext = step.task.replace(/\{previous\}/g, clampPreviousOutput(previousOutput));

					// Create update callback that includes all previous results
					const chainUpdate: OnUpdateCallback | undefined = onUpdate
						? (partial) => {
								// Combine completed results with current streaming result
								const currentResult = partial.details?.results[0];
								if (currentResult) {
									const allResults = [...results, currentResult];
									onUpdate({
										content: partial.content,
										details: makeDetails("chain")(allResults),
									});
								}
							}
						: undefined;

					const result = await runSingleAgent(
						ctx.cwd,
						agents,
						agentByName,
						availableModels,
						currentProvider,
						step.agent,
						taskWithContext,
						step.cwd,
						i + 1,
						signal,
						chainUpdate,
						makeDetails("chain"),
					);
					results.push(result);

					const isError = isErrorResult(result);
					if (isError) {
						const errorMsg = result.errorMessage || result.stderr || result.finalOutput || "(no output)";
						return {
							content: [{ type: "text", text: `Chain stopped at step ${i + 1} (${step.agent}): ${errorMsg}` }],
							details: makeDetails("chain")(results),
							isError: true,
						};
					}
					previousOutput = result.finalOutput;
				}
				return {
					content: [{ type: "text", text: results[results.length - 1].finalOutput || "(no output)" }],
					details: makeDetails("chain")(results),
				};
			}

			if (params.tasks && params.tasks.length > 0) {
				if (params.tasks.length > MAX_PARALLEL_TASKS)
					return {
						content: [
							{
								type: "text",
								text: `Too many parallel tasks (${params.tasks.length}). Max is ${MAX_PARALLEL_TASKS}.`,
							},
						],
						details: makeDetails("parallel")([]),
					};

				// Track all results for streaming updates
				const allResults: SingleResult[] = new Array(params.tasks.length);

				// Initialize placeholder results
				for (let i = 0; i < params.tasks.length; i++) {
					const { agent, resolvedModel } = getAgentRunInfo(
						agentByName,
						availableModels,
						currentProvider,
						params.tasks[i].agent,
					);
					allResults[i] = {
						agent: params.tasks[i].agent,
						agentSource: agent?.source ?? "unknown",
						task: params.tasks[i].task,
						exitCode: RUNNING_EXIT_CODE,
						displayItems: [],
						finalOutput: "",
						stderr: "",
						usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, contextTokens: 0, turns: 0 },
						model: resolvedModel,
					};
				}

				const emitParallelUpdate = () => {
					if (onUpdate) {
						const running = allResults.filter((r) => r.exitCode === RUNNING_EXIT_CODE).length;
						const done = allResults.filter((r) => r.exitCode !== RUNNING_EXIT_CODE).length;
						onUpdate({
							content: [
								{ type: "text", text: `Parallel: ${done}/${allResults.length} done, ${running} running...` },
							],
							details: makeDetails("parallel")([...allResults]),
						});
					}
				};

				emitParallelUpdate();

				const results = await mapWithConcurrencyLimit(params.tasks, MAX_CONCURRENCY, signal, async (t, index) => {
					const result = await runSingleAgent(
						ctx.cwd,
						agents,
						agentByName,
						availableModels,
						currentProvider,
						t.agent,
						t.task,
						t.cwd,
						undefined,
						signal,
						// Per-task update callback
						(partial) => {
							if (partial.details?.results[0]) {
								allResults[index] = partial.details.results[0];
								emitParallelUpdate();
							}
						},
						makeDetails("parallel"),
					);
					allResults[index] = result;
					emitParallelUpdate();
					return result;
				});

				const successCount = results.filter((r) => r.exitCode === 0).length;
				const summaries = results.map((r) => {
					const preview = getOutputPreview(r.finalOutput);
					return `[${r.agent}] ${r.exitCode === 0 ? "completed" : "failed"}: ${preview || "(no output)"}`;
				});
				return {
					content: [
						{
							type: "text",
							text: `Parallel: ${successCount}/${results.length} succeeded\n\n${summaries.join("\n\n")}`,
						},
					],
					details: makeDetails("parallel")(results),
				};
			}

			if (params.agent && params.task) {
				const result = await runSingleAgent(
					ctx.cwd,
					agents,
					agentByName,
					availableModels,
					currentProvider,
					params.agent,
					params.task,
					params.cwd,
					undefined,
					signal,
					onUpdate,
					makeDetails("single"),
				);
				const isError = isErrorResult(result);
				if (isError) {
					const errorMsg = result.errorMessage || result.stderr || result.finalOutput || "(no output)";
					return {
						content: [{ type: "text", text: `Agent ${result.stopReason || "failed"}: ${errorMsg}` }],
						details: makeDetails("single")([result]),
						isError: true,
					};
				}
				return {
					content: [{ type: "text", text: result.finalOutput || "(no output)" }],
					details: makeDetails("single")([result]),
				};
			}

			const available = agents.map((a) => `${a.name} (${a.source})`).join(", ") || "none";
			return {
				content: [{ type: "text", text: `Invalid parameters. Available agents: ${available}` }],
				details: makeDetails("single")([]),
			};
		},

		renderCall(args, theme) {
			const scope: AgentScope = args.agentScope ?? "user";
			if (args.chain && args.chain.length > 0) {
				let text =
					theme.fg("toolTitle", theme.bold("subagent ")) +
					theme.fg("accent", `chain (${args.chain.length} steps)`) +
					theme.fg("muted", ` [${scope}]`);
				for (let i = 0; i < Math.min(args.chain.length, 3); i++) {
					const step = args.chain[i];
					// Clean up {previous} placeholder for display
					const cleanTask = step.task.replace(/\{previous\}/g, "").trim();
					const preview = cleanTask.length > 40 ? `${cleanTask.slice(0, 40)}...` : cleanTask;
					text +=
						"\n  " +
						theme.fg("muted", `${i + 1}.`) +
						" " +
						theme.fg("accent", step.agent) +
						theme.fg("dim", ` ${preview}`);
				}
				if (args.chain.length > 3) text += `\n  ${theme.fg("muted", `... +${args.chain.length - 3} more`)}`;
				return new Text(text, 0, 0);
			}
			if (args.tasks && args.tasks.length > 0) {
				let text =
					theme.fg("toolTitle", theme.bold("subagent ")) +
					theme.fg("accent", `parallel (${args.tasks.length} tasks)`) +
					theme.fg("muted", ` [${scope}]`);
				for (const t of args.tasks.slice(0, 3)) {
					const preview = t.task.length > 40 ? `${t.task.slice(0, 40)}...` : t.task;
					text += `\n  ${theme.fg("accent", t.agent)}${theme.fg("dim", ` ${preview}`)}`;
				}
				if (args.tasks.length > 3) text += `\n  ${theme.fg("muted", `... +${args.tasks.length - 3} more`)}`;
				return new Text(text, 0, 0);
			}
			const agentName = args.agent || "...";
			const preview = args.task ? (args.task.length > 60 ? `${args.task.slice(0, 60)}...` : args.task) : "...";
			let text =
				theme.fg("toolTitle", theme.bold("subagent ")) +
				theme.fg("accent", agentName) +
				theme.fg("muted", ` [${scope}]`);
			text += `\n  ${theme.fg("dim", preview)}`;
			return new Text(text, 0, 0);
		},

		renderResult(result, { expanded }, theme) {
			const details = result.details as SubagentDetails | undefined;
			if (!details || details.results.length === 0) {
				const text = result.content[0];
				return new Text(text?.type === "text" ? text.text : "(no output)", 0, 0);
			}

			const mdTheme = getMarkdownTheme();

			const renderDisplayItems = (items: DisplayItem[], limit?: number) => {
				const toShow = limit ? items.slice(-limit) : items;
				const skipped = limit && items.length > limit ? items.length - limit : 0;
				let text = "";
				if (skipped > 0) text += theme.fg("muted", `... ${skipped} earlier items\n`);
				for (const item of toShow) {
					if (item.type === "text") {
						const preview = expanded ? item.text : item.text.split("\n").slice(0, 3).join("\n");
						text += `${theme.fg("toolOutput", preview)}\n`;
					} else {
						text += `${theme.fg("muted", `${ICONS.toolCall} `) + formatToolCall(item.name, item.args, theme.fg.bind(theme))}\n`;
					}
				}
				return text.trimEnd();
			};

			const getResultIcon = (r: SingleResult) => {
				if (isRunningResult(r)) return theme.fg("warning", ICONS.running);
				if (isErrorResult(r)) return theme.fg("error", ICONS.error);
				return theme.fg("success", ICONS.success);
			};

			const getResultOutputText = (r: SingleResult) => (isRunningResult(r) ? "(running...)" : "(no output)");

			const appendToolCalls = (container: Container, items: DisplayItem[]) => {
				for (const item of items) {
					if (item.type === "toolCall") {
						container.addChild(
							new Text(
								theme.fg("muted", `${ICONS.toolCall} `) + formatToolCall(item.name, item.args, theme.fg.bind(theme)),
								0,
								0,
							),
						);
					}
				}
			};

			const appendOutput = (container: Container, r: SingleResult) => {
				if (r.displayItems.length === 0 && !r.finalOutput) {
					container.addChild(new Text(theme.fg("muted", getResultOutputText(r)), 0, 0));
					return;
				}

				appendToolCalls(container, r.displayItems);
				if (r.finalOutput) {
					container.addChild(new Spacer(1));
					container.addChild(new Markdown(r.finalOutput.trim(), 0, 0, mdTheme));
				}
			};

			const appendUsage = (container: Container, r: SingleResult) => {
				const usageStr = formatUsageStats(r.usage, r.model);
				if (usageStr) container.addChild(new Text(theme.fg("dim", usageStr), 0, 0));
			};

			const getCollapsedBody = (r: SingleResult, limit: number) => {
				if (r.displayItems.length === 0) return theme.fg("muted", getResultOutputText(r));
				let text = renderDisplayItems(r.displayItems, limit);
				if (isRunningResult(r) && r.model) text += `\n${theme.fg("dim", `model: ${r.model}`)}`;
				return text;
			};

			const appendRunDetails = (container: Container, r: SingleResult, headerText: string) => {
				container.addChild(new Spacer(1));
				container.addChild(new Text(headerText, 0, 0));
				container.addChild(new Text(theme.fg("muted", "Task: ") + theme.fg("dim", r.task), 0, 0));
				appendOutput(container, r);
				appendUsage(container, r);
			};

			if (details.mode === "single" && details.results.length === 1) {
				const r = details.results[0];
				const icon = getResultIcon(r);
				const isError = isErrorResult(r);

				if (expanded) {
					const container = new Container();
					let header = `${icon} ${theme.fg("toolTitle", theme.bold(r.agent))}${theme.fg("muted", ` (${r.agentSource})`)}`;
					if (isError && r.stopReason) header += ` ${theme.fg("error", `[${r.stopReason}]`)}`;
					container.addChild(new Text(header, 0, 0));
					if (isError && r.errorMessage) {
						container.addChild(new Text(theme.fg("error", `Error: ${r.errorMessage}`), 0, 0));
					}
					container.addChild(new Spacer(1));
					container.addChild(new Text(theme.fg("muted", "─── Task ───"), 0, 0));
					container.addChild(new Text(theme.fg("dim", r.task), 0, 0));
					container.addChild(new Spacer(1));
					container.addChild(new Text(theme.fg("muted", "─── Output ───"), 0, 0));
					appendOutput(container, r);
					const usageStr = formatUsageStats(r.usage, r.model);
					if (usageStr) {
						container.addChild(new Spacer(1));
						container.addChild(new Text(theme.fg("dim", usageStr), 0, 0));
					}
					return container;
				}

				let text = `${icon} ${theme.fg("toolTitle", theme.bold(r.agent))}${theme.fg("muted", ` (${r.agentSource})`)}`;
				if (isError && r.stopReason) text += ` ${theme.fg("error", `[${r.stopReason}]`)}`;
				if (isError && r.errorMessage) text += `\n${theme.fg("error", `Error: ${r.errorMessage}`)}`;
				else text += `\n${getCollapsedBody(r, COLLAPSED_ITEM_COUNT)}`;
				if (r.displayItems.length > COLLAPSED_ITEM_COUNT) text += `\n${theme.fg("muted", "(Ctrl+O to expand)")}`;
				const usageStr = formatUsageStats(r.usage, r.model);
				if (usageStr) text += `\n${theme.fg("dim", usageStr)}`;
				return new Text(text, 0, 0);
			}

			if (details.mode === "chain") {
				const runningCount = details.results.filter((r) => isRunningResult(r)).length;
				const successCount = details.results.filter((r) => r.exitCode === 0).length;
				const icon =
					runningCount > 0
						? theme.fg("warning", ICONS.running)
						: successCount === details.results.length
							? theme.fg("success", ICONS.success)
							: theme.fg("error", ICONS.error);
				const status =
					runningCount > 0
						? `${successCount} completed, ${runningCount} running`
						: `${successCount}/${details.results.length} steps`;

				if (expanded) {
					const container = new Container();
					container.addChild(
						new Text(icon + " " + theme.fg("toolTitle", theme.bold("chain ")) + theme.fg("accent", status), 0, 0),
					);
					for (const r of details.results) {
						appendRunDetails(
							container,
							r,
							`${theme.fg("muted", `─── Step ${r.step}: `) + theme.fg("accent", r.agent)} ${getResultIcon(r)}`,
						);
					}
					const usageStr = formatUsageStats(aggregateUsage(details.results));
					if (usageStr) {
						container.addChild(new Spacer(1));
						container.addChild(new Text(theme.fg("dim", `Total: ${usageStr}`), 0, 0));
					}
					return container;
				}

				let text = `${icon} ${theme.fg("toolTitle", theme.bold("chain "))}${theme.fg("accent", status)}`;
				for (const r of details.results) {
					text += `\n\n${theme.fg("muted", `─── Step ${r.step}: `)}${theme.fg("accent", r.agent)} ${getResultIcon(r)}`;
					text += `\n${getCollapsedBody(r, 5)}`;
				}
				const usageStr = formatUsageStats(aggregateUsage(details.results));
				if (usageStr) text += `\n\n${theme.fg("dim", `Total: ${usageStr}`)}`;
				text += `\n${theme.fg("muted", "(Ctrl+O to expand)")}`;
				return new Text(text, 0, 0);
			}

			if (details.mode === "parallel") {
				const running = details.results.filter((r) => r.exitCode === RUNNING_EXIT_CODE).length;
				const successCount = details.results.filter((r) => r.exitCode === 0).length;
				const failCount = details.results.filter((r) => r.exitCode > 0).length;
				const isRunning = running > 0;
				const icon = isRunning
					? theme.fg("warning", ICONS.running)
					: failCount > 0
						? theme.fg("warning", ICONS.partial)
						: theme.fg("success", ICONS.success);
				const status = isRunning
					? `${successCount + failCount}/${details.results.length} done, ${running} running`
					: `${successCount}/${details.results.length} tasks`;

				if (expanded && !isRunning) {
					const container = new Container();
					container.addChild(
						new Text(`${icon} ${theme.fg("toolTitle", theme.bold("parallel "))}${theme.fg("accent", status)}`, 0, 0),
					);
					for (const r of details.results) {
						appendRunDetails(
							container,
							r,
							`${theme.fg("muted", "─── ") + theme.fg("accent", r.agent)} ${getResultIcon(r)}`,
						);
					}
					const usageStr = formatUsageStats(aggregateUsage(details.results));
					if (usageStr) {
						container.addChild(new Spacer(1));
						container.addChild(new Text(theme.fg("dim", `Total: ${usageStr}`), 0, 0));
					}
					return container;
				}

				let text = `${icon} ${theme.fg("toolTitle", theme.bold("parallel "))}${theme.fg("accent", status)}`;
				for (const r of details.results) {
					text += `\n\n${theme.fg("muted", "─── ")}${theme.fg("accent", r.agent)} ${getResultIcon(r)}`;
					text += `\n${getCollapsedBody(r, 5)}`;
				}
				if (!isRunning) {
					const usageStr = formatUsageStats(aggregateUsage(details.results));
					if (usageStr) text += `\n\n${theme.fg("dim", `Total: ${usageStr}`)}`;
				}
				if (!expanded) text += `\n${theme.fg("muted", "(Ctrl+O to expand)")}`;
				return new Text(text, 0, 0);
			}

			const text = result.content[0];
			return new Text(text?.type === "text" ? text.text : "(no output)", 0, 0);
		},
	});
}
