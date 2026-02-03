import { dirname, resolve as resolvePath } from "node:path";
import * as fsPromises from "node:fs/promises";
import lockfile from "proper-lockfile";
import { spawn as defaultSpawn } from "@poe-code/agent-spawn";
import { isCancel, select as clackSelect } from "@clack/prompts";
import { isNotFound } from "@poe-code/config-mutations";
import { detectCompletion } from "../completion/detector.js";
import { getChangedFiles, getCommitList, getDirtyFiles, getHead } from "../git/utils.js";
import { parsePlan } from "../plan/parser.js";
import { writePlan } from "../plan/writer.js";
import { renderPrompt } from "../prompt/renderer.js";
import { selectStory } from "../story/selector.js";
import { updateStoryStatus } from "../story/updater.js";
import { writeRunMeta } from "../run/metadata.js";
import type { Story } from "../plan/types.js";
import { OverbakingDetector } from "./overbaking.js";

type LockRelease = () => Promise<void>;
type LockFn = (path: string) => Promise<LockRelease>;

type BuildLoopFileSystem = {
  readFile(path: string, encoding: BufferEncoding): Promise<string>;
  writeFile(
    path: string,
    data: string,
    options?: { encoding?: BufferEncoding }
  ): Promise<void>;
  mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
};

type SpawnFn = (
  agentId: string,
  options: {
    prompt: string;
    cwd?: string;
    model?: string;
    args?: string[];
    useStdin?: boolean;
  }
) => Promise<{ stdout: string; stderr: string; exitCode: number }>;

type GitDeps = {
  getHead(cwd: string): string | null;
  getCommitList(cwd: string, before: string, after: string): { hash: string; subject: string }[];
  getChangedFiles(cwd: string, before: string, after: string): string[];
  getDirtyFiles(cwd: string): string[];
};

export type BuildIterationStatus = "success" | "failure" | "incomplete";

export type BuildIterationResult = {
  iteration: number;
  storyId: string;
  storyTitle: string;
  status: BuildIterationStatus;
  logPath: string;
  metaPath: string;
};

export type BuildResult = {
  runId: string;
  iterationsCompleted: number;
  storiesDone: string[];
  iterations: BuildIterationResult[];
  stopReason: "no_actionable_stories" | "max_iterations" | "overbake_abort";
};

export type BuildLoopOptions = {
  planPath: string;
  progressPath?: string;
  guardrailsPath?: string;
  errorsLogPath?: string;
  activityLogPath?: string;
  maxIterations: number;
  maxFailures?: number;
  pauseOnOverbake?: boolean;
  noCommit: boolean;
  agent: string;
  staleSeconds: number;
  cwd: string;
  deps?: Partial<{
    fs: BuildLoopFileSystem;
    lock: LockFn;
    spawn: SpawnFn;
    git: GitDeps;
    now(): Date;
    runId: string;
    stderr: { write(chunk: string): void };
    promptOverbake(
      args: {
        storyId: string;
        storyTitle: string;
        consecutiveFailures: number;
        threshold: number;
      }
    ): Promise<"continue" | "skip" | "abort">;
  }>;
};

function absPath(cwd: string, path: string): string {
  if (!path) return resolvePath(cwd);
  return path.startsWith("/") ? path : resolvePath(cwd, path);
}

function pad2(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

function formatTimestamp(date: Date): string {
  const year = date.getFullYear();
  const month = pad2(date.getMonth() + 1);
  const day = pad2(date.getDate());
  const hours = pad2(date.getHours());
  const minutes = pad2(date.getMinutes());
  const seconds = pad2(date.getSeconds());
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function createRunId(now: Date): string {
  const year = now.getFullYear();
  const month = pad2(now.getMonth() + 1);
  const day = pad2(now.getDate());
  const hours = pad2(now.getHours());
  const minutes = pad2(now.getMinutes());
  const seconds = pad2(now.getSeconds());
  const ms = now.getMilliseconds();
  const rand = Math.floor(Math.random() * 100000);
  return `${year}${month}${day}-${hours}${minutes}${seconds}-${String(ms).padStart(3, "0")}-${rand}`;
}

function formatAgentSetupHint(agentId: string): string {
  return [
    "",
    "Setup hint:",
    "- Ensure the agent CLI is installed and on PATH.",
    `- Run: poe-code configure ${agentId}`,
    ""
  ].join("\n");
}

async function appendToErrorsLog(
  fs: BuildLoopFileSystem,
  errorsLogPath: string,
  message: string
): Promise<void> {
  const next = message.endsWith("\n") ? message : `${message}\n`;
  let previous = "";
  try {
    previous = await fs.readFile(errorsLogPath, "utf8");
  } catch (error) {
    if (isNotFound(error)) {
      previous = "";
    } else {
      throw error;
    }
  }
  await fs.mkdir(dirname(errorsLogPath), { recursive: true });
  await fs.writeFile(errorsLogPath, `${previous}${next}`, { encoding: "utf8" });
}

async function lockPlanFile(path: string): Promise<LockRelease> {
  const release = await lockfile.lock(path, {
    retries: {
      retries: 20,
      minTimeout: 25,
      maxTimeout: 250
    }
  });
  return async () => {
    await release();
  };
}

function formatQualityGates(gates: readonly string[]): string {
  if (gates.length === 0) return "- (none)";
  return gates.map((gate) => `- ${gate}`).join("\n");
}

function formatStoryBlock(story: Story): string {
  const deps = story.dependsOn.length === 0 ? "(none)" : story.dependsOn.join(", ");
  const description = story.description?.trim() ? story.description.trim() : "(none)";
  const criteria =
    story.acceptanceCriteria.length === 0
      ? "- (none)"
      : story.acceptanceCriteria.map((item) => `- [ ] ${item}`).join("\n");

  return [
    `### ${story.id}: ${story.title}`,
    `Status: ${story.status}`,
    `Depends on: ${deps}`,
    "",
    "Description:",
    description,
    "",
    "Acceptance Criteria:",
    criteria,
    ""
  ].join("\n");
}

async function selectStoryFromFile(
  planPath: string,
  options: {
    fs: BuildLoopFileSystem;
    lock: LockFn;
    now: Date;
    staleSeconds: number;
    ignoreStoryIds?: ReadonlySet<string>;
  }
): Promise<{ story: Story; qualityGates: string[] } | null> {
  const release = await options.lock(planPath);
  try {
    const raw = await options.fs.readFile(planPath, "utf8");
    const prd = parsePlan(raw);
    const selected = selectStory(prd, {
      now: options.now,
      staleSeconds: options.staleSeconds,
      ignoreStoryIds: options.ignoreStoryIds
    });
    if (!selected) return null;

    const nowIso = options.now.toISOString();
    selected.status = "in_progress";
    if (!selected.startedAt) selected.startedAt = nowIso;
    selected.completedAt = undefined;
    selected.updatedAt = nowIso;

    await writePlan(planPath, prd, {
      fs: options.fs,
      lock: async () => async () => {}
    });

    return { story: selected, qualityGates: prd.qualityGates };
  } finally {
    await release();
  }
}

function formatOverbakeWarning(args: {
  storyId: string;
  storyTitle: string;
  consecutiveFailures: number;
  threshold: number;
}): string {
  return [
    `[OVERBAKE] ${args.storyId}: ${args.storyTitle}`,
    `Reached ${args.consecutiveFailures} consecutive failures (threshold ${args.threshold}).`,
    "Consider splitting the story, adjusting the prompt/guardrails, or stopping this run.",
    ""
  ].join("\n");
}

async function defaultPromptOverbake(args: {
  storyId: string;
  storyTitle: string;
  consecutiveFailures: number;
  threshold: number;
}): Promise<"continue" | "skip" | "abort"> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return "continue";
  }

  const value = await clackSelect({
    message: `Overbaking detected for ${args.storyId} (${args.consecutiveFailures}/${args.threshold} failures).`,
    options: [
      { value: "continue", label: "Continue" },
      { value: "skip", label: "Skip story for this run" },
      { value: "abort", label: "Abort run" }
    ]
  });

  if (isCancel(value)) return "abort";
  return value as "continue" | "skip" | "abort";
}

export async function buildLoop(options: BuildLoopOptions): Promise<BuildResult> {
  const fs = options.deps?.fs ?? (fsPromises as unknown as BuildLoopFileSystem);
  const lock = options.deps?.lock ?? lockPlanFile;
  const spawn = options.deps?.spawn ?? (defaultSpawn as unknown as SpawnFn);
  const git: GitDeps = options.deps?.git ?? {
    getHead,
    getCommitList,
    getChangedFiles,
    getDirtyFiles
  };
  const nowFn = options.deps?.now ?? (() => new Date());
  const stderr = options.deps?.stderr ?? process.stderr;
  const promptOverbake = options.deps?.promptOverbake ?? defaultPromptOverbake;

  const cwd = absPath(options.cwd, ".");
  const planPath = absPath(cwd, options.planPath);

  const progressPath = absPath(cwd, options.progressPath ?? ".ralph/progress.md");
  const guardrailsPath = absPath(cwd, options.guardrailsPath ?? ".ralph/guardrails.md");
  const errorsLogPath = absPath(cwd, options.errorsLogPath ?? ".ralph/errors.log");
  const activityLogPath = absPath(cwd, options.activityLogPath ?? ".ralph/activity.log");
  const guardrailsRef = absPath(cwd, ".agents/ralph/references/GUARDRAILS.md");
  const contextRef = absPath(cwd, ".agents/ralph/references/CONTEXT_ENGINEERING.md");
  const activityCmd = absPath(cwd, ".agents/ralph/log-activity.sh");
  const promptTemplatePath = absPath(cwd, ".agents/ralph/PROMPT_build.md");
  const runsDir = absPath(cwd, ".ralph/runs");

  const runId = options.deps?.runId ?? createRunId(nowFn());

  const overbaking = new OverbakingDetector({ threshold: options.maxFailures });
  const skippedStoryIds = new Set<string>();

  const storiesDone: string[] = [];
  const iterations: BuildIterationResult[] = [];

  for (let i = 1; i <= options.maxIterations; i++) {
    const iterationStart = nowFn();
    const headBefore = git.getHead(cwd);

    const selection = await selectStoryFromFile(planPath, {
      fs,
      lock,
      now: iterationStart,
      staleSeconds: options.staleSeconds,
      ignoreStoryIds: skippedStoryIds
    });

    if (!selection) {
      return {
        runId,
        iterationsCompleted: iterations.length,
        storiesDone,
        iterations,
        stopReason: "no_actionable_stories"
      };
    }

    const story = selection.story;
    const storyBlock = formatStoryBlock(story);

    const logPath = resolvePath(runsDir, `run-${runId}-iter-${i}.log`);
    const metaPath = resolvePath(runsDir, `run-${runId}-iter-${i}.md`);
    const renderedPromptPath = resolvePath(
      absPath(cwd, ".ralph/.tmp"),
      `prompt-build-${runId}-iter-${i}.md`
    );

    const template = await fs.readFile(promptTemplatePath, "utf8");
    const prompt = renderPrompt(template, {
      PLAN_PATH: planPath,
      PROGRESS_PATH: progressPath,
      REPO_ROOT: cwd,
      GUARDRAILS_PATH: guardrailsPath,
      ERRORS_LOG_PATH: errorsLogPath,
      ACTIVITY_LOG_PATH: activityLogPath,
      GUARDRAILS_REF: guardrailsRef,
      CONTEXT_REF: contextRef,
      ACTIVITY_CMD: activityCmd,
      NO_COMMIT: options.noCommit,
      RUN_ID: runId,
      ITERATION: i,
      RUN_LOG_PATH: logPath,
      RUN_META_PATH: metaPath,
      STORY_ID: story.id,
      STORY_TITLE: story.title,
      STORY_BLOCK: storyBlock,
      QUALITY_GATES: formatQualityGates(selection.qualityGates)
    });

    await fs.mkdir(dirname(renderedPromptPath), { recursive: true });
    await fs.writeFile(renderedPromptPath, prompt, { encoding: "utf8" });

    let status: BuildIterationStatus = "failure";
    let combinedOutput = "";
    let stderrForErrorsLog = "";
    let overbakeAction: "continue" | "skip" | "abort" | null = null;

    try {
      const result = await spawn(options.agent, { prompt, cwd, useStdin: true });

      const stdout = result.stdout ?? "";
      const stderr = result.stderr ?? "";
      stderrForErrorsLog = stderr;

      combinedOutput = [
        stdout ? `# stdout\n${stdout}` : "",
        stderr ? `# stderr\n${stderr}` : ""
      ]
        .filter(Boolean)
        .join("\n");

      if (result.exitCode !== 0) {
        status = "failure";
        combinedOutput = `${combinedOutput}${formatAgentSetupHint(options.agent)}`;
        stderrForErrorsLog = `${stderr}${formatAgentSetupHint(options.agent)}`;
      } else if (detectCompletion(stdout)) {
        status = "success";
      } else {
        status = "incomplete";
      }
    } catch (error) {
      const detail =
        error instanceof Error ? error.message : `Unknown error: ${String(error)}`;
      combinedOutput = `Agent execution error: ${detail}${formatAgentSetupHint(options.agent)}`;
      stderrForErrorsLog = combinedOutput;
      status = "failure";
    }

    await fs.mkdir(dirname(logPath), { recursive: true });
    await fs.writeFile(logPath, combinedOutput, { encoding: "utf8" });

    if (status === "failure" && stderrForErrorsLog.trim().length > 0) {
      await appendToErrorsLog(fs, errorsLogPath, stderrForErrorsLog);
    }

    const overbakeEvent = overbaking.record(story.id, status);
    if (overbakeEvent.shouldWarn) {
      const warning = formatOverbakeWarning({
        storyId: story.id,
        storyTitle: story.title,
        consecutiveFailures: overbakeEvent.consecutiveFailures,
        threshold: overbakeEvent.threshold
      });
      stderr.write(warning);
      await appendToErrorsLog(fs, errorsLogPath, warning);

      if (options.pauseOnOverbake) {
        overbakeAction = await promptOverbake({
          storyId: story.id,
          storyTitle: story.title,
          consecutiveFailures: overbakeEvent.consecutiveFailures,
          threshold: overbakeEvent.threshold
        });
      } else {
        overbakeAction = "continue";
      }

      if (overbakeAction === "skip") {
        skippedStoryIds.add(story.id);
      }
    }

    const iterationEnd = nowFn();
    const durationSeconds = Math.max(
      0,
      Math.round((iterationEnd.getTime() - iterationStart.getTime()) / 1000)
    );

    if (status === "success") {
      await updateStoryStatus(planPath, story.id, "done", {
        fs,
        lock,
        now: iterationEnd
      });
      storiesDone.push(story.id);
    } else {
      await updateStoryStatus(planPath, story.id, "open", {
        fs,
        lock,
        now: iterationEnd
      });
    }

    const headAfter = git.getHead(cwd);
    const dirtyFiles = git.getDirtyFiles(cwd);

    const commits =
      headBefore && headAfter && headBefore !== headAfter
        ? git.getCommitList(cwd, headBefore, headAfter)
        : [];
    const changedFiles =
      headBefore && headAfter && headBefore !== headAfter
        ? git.getChangedFiles(cwd, headBefore, headAfter)
        : [];

    await writeRunMeta(
      metaPath,
      {
        runId,
        iteration: i,
        mode: "build",
        storyId: story.id,
        storyTitle: story.title,
        started: formatTimestamp(iterationStart),
        ended: formatTimestamp(iterationEnd),
        duration: `${durationSeconds}s`,
        status,
        logPath,
        overbaking: {
          maxFailures: overbakeEvent.threshold,
          consecutiveFailures: overbakeEvent.consecutiveFailures,
          triggered: overbakeEvent.overbaked,
          action: overbakeAction ?? undefined
        },
        git: {
          headBefore,
          headAfter,
          commits,
          changedFiles,
          dirtyFiles
        }
      },
      { fs }
    );

    iterations.push({
      iteration: i,
      storyId: story.id,
      storyTitle: story.title,
      status,
      logPath,
      metaPath
    });

    if (overbakeAction === "abort") {
      return {
        runId,
        iterationsCompleted: iterations.length,
        storiesDone,
        iterations,
        stopReason: "overbake_abort"
      };
    }
  }

  return {
    runId,
    iterationsCompleted: iterations.length,
    storiesDone,
    iterations,
    stopReason: "max_iterations"
  };
}
