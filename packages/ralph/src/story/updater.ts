import { dirname } from "node:path";
import * as fsPromises from "node:fs/promises";
import { lockFile } from "../lock/lock.js";
import { parsePlan } from "../plan/parser.js";
import { writePlan } from "../plan/writer.js";
import type { Plan, Story, StoryStatus } from "../plan/types.js";

type LockRelease = () => Promise<void>;
type LockFn = (path: string) => Promise<LockRelease>;

type PlanUpdaterFileSystem = {
  readFile(path: string, encoding: BufferEncoding): Promise<string>;
  mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
  writeFile(
    path: string,
    data: string,
    options?: { encoding?: BufferEncoding }
  ): Promise<void>;
};

export type UpdateStoryStatusOptions = {
  fs?: PlanUpdaterFileSystem;
  lock?: LockFn;
  now?: Date;
};

function lockPlanFile(path: string): Promise<LockRelease> {
  return lockFile(path, { retries: 20, minTimeout: 25, maxTimeout: 250 });
}

function assertStoryStatus(value: unknown): asserts value is StoryStatus {
  if (value === "open") return;
  if (value === "in_progress") return;
  if (value === "done") return;
  throw new Error(`Invalid story status "${String(value)}"`);
}

function findStory(plan: Plan, storyId: string): Story {
  const story = plan.stories.find((s) => s.id === storyId);
  if (!story) {
    throw new Error(`Story not found: ${storyId}`);
  }
  return story;
}

export async function updateStoryStatus(
  planPath: string,
  storyId: string,
  status: StoryStatus,
  options: UpdateStoryStatusOptions = {}
): Promise<void> {
  assertStoryStatus(status);

  const fs = options.fs ?? (fsPromises as unknown as PlanUpdaterFileSystem);
  const lock = options.lock ?? lockPlanFile;
  const now = options.now ?? new Date();
  const nowIso = now.toISOString();

  await fs.mkdir(dirname(planPath), { recursive: true });

  const release = await lock(planPath);
  try {
    const yaml = await fs.readFile(planPath, "utf8");
    const plan = parsePlan(yaml);
    const story = findStory(plan, storyId);

    const previousStatus = story.status;
    story.status = status;
    story.updatedAt = nowIso;

    if (status === "open") {
      story.startedAt = undefined;
      story.completedAt = undefined;
    } else if (status === "in_progress") {
      if (!story.startedAt) {
        story.startedAt = nowIso;
      }
      story.completedAt = undefined;
    } else if (status === "done") {
      if (previousStatus !== "done" && !story.completedAt) {
        story.completedAt = nowIso;
      }
    }

    await writePlan(planPath, plan, {
      fs,
      lock: async () => async () => {}
    });
  } finally {
    await release();
  }
}
