import { join, dirname } from "node:path";
import { parse, stringify } from "yaml";
import type {
  Worktree,
  WorktreeRegistry,
  WorktreeFileSystem,
  WorktreeStatus
} from "./types.js";

const REGISTRY_DIR = ".poe-code-worktrees";
const REGISTRY_FILE = "worktrees.yaml";

export function registryPath(cwd: string): string {
  return join(cwd, REGISTRY_DIR, REGISTRY_FILE);
}

export async function readRegistry(
  cwd: string,
  fs: WorktreeFileSystem
): Promise<WorktreeRegistry> {
  const path = registryPath(cwd);
  try {
    const content = await fs.readFile(path, "utf8");
    const parsed = parse(content) as WorktreeRegistry | null;
    return parsed?.worktrees ? parsed : { worktrees: [] };
  } catch {
    return { worktrees: [] };
  }
}

export async function writeRegistry(
  cwd: string,
  registry: WorktreeRegistry,
  fs: WorktreeFileSystem
): Promise<void> {
  const path = registryPath(cwd);
  await fs.mkdir(dirname(path), { recursive: true });
  const yaml = stringify(registry, { lineWidth: 0 });
  await fs.writeFile(path, yaml, { encoding: "utf8" });
}

export async function addWorktreeEntry(
  cwd: string,
  entry: Worktree,
  fs: WorktreeFileSystem
): Promise<void> {
  const registry = await readRegistry(cwd, fs);
  registry.worktrees.push(entry);
  await writeRegistry(cwd, registry, fs);
}

export async function removeWorktreeEntry(
  cwd: string,
  name: string,
  fs: WorktreeFileSystem
): Promise<void> {
  const registry = await readRegistry(cwd, fs);
  registry.worktrees = registry.worktrees.filter((w) => w.name !== name);
  await writeRegistry(cwd, registry, fs);
}

export async function updateWorktreeStatus(
  cwd: string,
  name: string,
  status: WorktreeStatus,
  deps: { fs: WorktreeFileSystem }
): Promise<void> {
  const { fs } = deps;
  const registry = await readRegistry(cwd, fs);
  const entry = registry.worktrees.find((w) => w.name === name);
  if (!entry) {
    throw new Error(`Worktree "${name}" not found in registry`);
  }
  entry.status = status;
  await writeRegistry(cwd, registry, fs);
}
