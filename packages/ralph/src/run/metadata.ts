import { dirname } from "node:path";
import * as fsPromises from "node:fs/promises";

export type RunCommit = {
  hash: string;
  subject: string;
};

export type RunGitMetadata = {
  headBefore?: string | null;
  headAfter?: string | null;
  commits?: RunCommit[] | null;
  changedFiles?: string[] | null;
  dirtyFiles?: string[] | null;
};

export type RunMetadata = {
  runId: string;
  iteration: number;
  storyId: string;
  storyTitle: string;
  started: string;
  ended: string;
  duration: string | number;
  status: string;
  mode?: string;
  logPath?: string;
  overbaking?: {
    maxFailures: number;
    consecutiveFailures: number;
    triggered: boolean;
    action?: "continue" | "skip" | "abort";
  } | null;
  git?: RunGitMetadata | null;
};

export type WriteRunMetaOptions = {
  fs?: {
    mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
    writeFile(
      path: string,
      data: string,
      options?: { encoding?: BufferEncoding }
    ): Promise<void>;
  };
};

function formatCommitLine(commit: RunCommit): string {
  const hash = commit.hash.length > 7 ? commit.hash.slice(0, 7) : commit.hash;
  return `${hash} ${commit.subject}`;
}

function appendSection(
  lines: string[],
  title: string,
  items: readonly string[] | null | undefined,
  options: { emptyLabel: string }
): void {
  if (items === undefined || items === null) return;

  lines.push(title);
  if (items.length === 0) {
    lines.push(`- ${options.emptyLabel}`);
    lines.push("");
    return;
  }

  for (const item of items) {
    lines.push(`- ${item}`);
  }
  lines.push("");
}

export async function writeRunMeta(
  path: string,
  metadata: RunMetadata,
  options: WriteRunMetaOptions = {}
): Promise<void> {
  const fs = options.fs ?? fsPromises;

  await fs.mkdir(dirname(path), { recursive: true });

  const lines: string[] = [];
  lines.push("# Ralph Run Summary", "");
  lines.push(`- Run ID: ${metadata.runId}`);
  lines.push(`- Iteration: ${metadata.iteration}`);
  if (metadata.mode) {
    lines.push(`- Mode: ${metadata.mode}`);
  }
  lines.push(`- Story: ${metadata.storyId}: ${metadata.storyTitle}`);
  lines.push(`- Started: ${metadata.started}`);
  lines.push(`- Ended: ${metadata.ended}`);
  lines.push(`- Duration: ${String(metadata.duration)}`);
  lines.push(`- Status: ${metadata.status}`);
  if (metadata.logPath) {
    lines.push(`- Log: ${metadata.logPath}`);
  }

  const overbaking = metadata.overbaking ?? null;
  if (overbaking) {
    lines.push("", "## Overbaking");
    lines.push(`- Max failures: ${overbaking.maxFailures}`);
    lines.push(`- Consecutive failures: ${overbaking.consecutiveFailures}`);
    lines.push(`- Triggered: ${overbaking.triggered ? "yes" : "no"}`);
    if (overbaking.action) {
      lines.push(`- Action: ${overbaking.action}`);
    }
  }

  const git = metadata.git ?? null;
  if (!git) {
    lines.push("");
    await fs.writeFile(path, lines.join("\n"), { encoding: "utf8" });
    return;
  }

  lines.push("", "## Git");
  if (git.headBefore) {
    lines.push(`- Head (before): ${git.headBefore}`);
  }
  if (git.headAfter) {
    lines.push(`- Head (after): ${git.headAfter}`);
  }

  const hasAnySection =
    git.commits !== undefined ||
    git.changedFiles !== undefined ||
    git.dirtyFiles !== undefined;
  if (hasAnySection) {
    lines.push("");
  } else {
    lines.push("");
    await fs.writeFile(path, lines.join("\n"), { encoding: "utf8" });
    return;
  }

  if (git.commits !== undefined && git.commits !== null) {
    lines.push("### Commits");
    if (git.commits.length === 0) {
      lines.push("- (none)", "");
    } else {
      for (const commit of git.commits) {
        lines.push(`- ${formatCommitLine(commit)}`);
      }
      lines.push("");
    }
  }

  appendSection(lines, "### Changed Files (commits)", git.changedFiles, {
    emptyLabel: "(none)"
  });
  appendSection(lines, "### Uncommitted Changes", git.dirtyFiles, {
    emptyLabel: "(none)"
  });

  await fs.writeFile(path, lines.join("\n"), { encoding: "utf8" });
}
