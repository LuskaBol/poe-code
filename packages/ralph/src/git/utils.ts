import { execSync } from "node:child_process";

export type GitCommit = {
  hash: string;
  subject: string;
};

function isHexCommitHash(value: string): boolean {
  if (value.length !== 40) return false;
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    const isDigit = code >= 48 && code <= 57;
    const isLowerHex = code >= 97 && code <= 102;
    const isUpperHex = code >= 65 && code <= 70;
    if (!isDigit && !isLowerHex && !isUpperHex) return false;
  }
  return true;
}

function tryExecGit(cwd: string, command: string): string | null {
  try {
    return execSync(command, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    });
  } catch {
    return null;
  }
}

function shellEscape(value: string): string {
  return `'${value.split("'").join("'\\''")}'`;
}

export function getHead(cwd: string): string | null {
  const output = tryExecGit(cwd, "git rev-parse HEAD");
  if (!output) return null;

  const hash = output.trim();
  return isHexCommitHash(hash) ? hash : null;
}

export function getCommitList(
  cwd: string,
  before: string,
  after: string
): GitCommit[] {
  const range = `${before}..${after}`;
  const output = tryExecGit(
    cwd,
    `git log --format=%H%x09%s ${shellEscape(range)}`
  );
  if (!output) return [];

  const lines = output.split("\n");
  const commits: GitCommit[] = [];

  for (const line of lines) {
    if (!line) continue;

    const tabIndex = line.indexOf("\t");
    if (tabIndex <= 0) continue;

    const hash = line.slice(0, tabIndex);
    if (!isHexCommitHash(hash)) continue;

    const subject = line.slice(tabIndex + 1);
    commits.push({ hash, subject });
  }

  return commits;
}

export function getChangedFiles(
  cwd: string,
  before: string,
  after: string
): string[] {
  const output = tryExecGit(
    cwd,
    `git diff --name-only ${shellEscape(before)} ${shellEscape(after)}`
  );
  if (!output) return [];

  return output
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean);
}

export function getDirtyFiles(cwd: string): string[] {
  const output = tryExecGit(cwd, "git status --porcelain");
  if (!output) return [];

  const files: string[] = [];
  const lines = output.split("\n");

  for (const line of lines) {
    if (!line) continue;
    if (line.length < 4) continue;

    let path = line.slice(3).trim();
    const renameArrow = " -> ";
    const arrowIndex = path.lastIndexOf(renameArrow);
    if (arrowIndex >= 0) {
      path = path.slice(arrowIndex + renameArrow.length).trim();
    }

    if (path) files.push(path);
  }

  return files;
}
