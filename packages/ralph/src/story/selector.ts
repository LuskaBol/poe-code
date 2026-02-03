import type { Plan, Story } from "../plan/types.js";

export type SelectStoryOptions = {
  now?: Date;
  staleSeconds?: number;
  ignoreStoryIds?: ReadonlySet<string>;
};

function isStaleStory(
  story: Story,
  nowMs: number,
  staleSeconds: number
): boolean {
  if (!Number.isFinite(staleSeconds) || staleSeconds < 0) return false;
  if (staleSeconds === 0) return true;

  if (!story.startedAt) return true;

  const startedMs = Date.parse(story.startedAt);
  if (!Number.isFinite(startedMs)) return true;

  return nowMs - startedMs > staleSeconds * 1000;
}

function resetStaleStories(prd: Plan, nowMs: number, staleSeconds: number): void {
  for (const story of prd.stories) {
    if (story.status !== "in_progress") continue;
    if (!isStaleStory(story, nowMs, staleSeconds)) continue;

    story.status = "open";
    story.startedAt = undefined;
  }
}

function buildStatusById(prd: Plan): Map<string, Story["status"]> {
  const statusById = new Map<string, Story["status"]>();
  for (const story of prd.stories) {
    statusById.set(story.id, story.status);
  }
  return statusById;
}

function hasMetDependencies(
  story: Story,
  statusById: Map<string, Story["status"]>
): boolean {
  for (const depId of story.dependsOn) {
    if (statusById.get(depId) !== "done") return false;
  }
  return true;
}

export function selectStory(prd: Plan, options: SelectStoryOptions = {}): Story | null {
  const now = options.now ?? new Date();
  const nowMs = now.getTime();
  const staleSeconds = options.staleSeconds ?? Number.POSITIVE_INFINITY;
  const ignoreStoryIds = options.ignoreStoryIds ?? null;

  resetStaleStories(prd, nowMs, staleSeconds);

  const existing = prd.stories.find((s) => s.status === "in_progress");
  if (existing && (!ignoreStoryIds || !ignoreStoryIds.has(existing.id))) {
    if (!existing.startedAt) existing.startedAt = now.toISOString();
    return existing;
  }

  if (existing && ignoreStoryIds?.has(existing.id)) {
    existing.status = "open";
    existing.startedAt = undefined;
  }

  const statusById = buildStatusById(prd);
  for (const story of prd.stories) {
    if (story.status !== "open") continue;
    if (ignoreStoryIds?.has(story.id)) continue;
    if (!hasMetDependencies(story, statusById)) continue;

    story.status = "in_progress";
    story.startedAt = now.toISOString();
    return story;
  }

  return null;
}
