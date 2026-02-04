import { dirname } from "node:path";
import { parse, stringify } from "yaml";
import type {
  Worktree,
  WorktreeRegistry,
  WorktreeFileSystem,
  WorktreeStatus
} from "./types.js";

export async function readRegistry(
  registryFile: string,
  fs: WorktreeFileSystem
): Promise<WorktreeRegistry> {
  try {
    const content = await fs.readFile(registryFile, "utf8");
    const parsed = parse(content) as WorktreeRegistry | null;
    return parsed?.worktrees ? parsed : { worktrees: [] };
  } catch {
    return { worktrees: [] };
  }
}

export async function writeRegistry(
  registryFile: string,
  registry: WorktreeRegistry,
  fs: WorktreeFileSystem
): Promise<void> {
  await fs.mkdir(dirname(registryFile), { recursive: true });
  const yaml = stringify(registry, { lineWidth: 0 });
  await fs.writeFile(registryFile, yaml, { encoding: "utf8" });
}

export async function addWorktreeEntry(
  registryFile: string,
  entry: Worktree,
  fs: WorktreeFileSystem
): Promise<void> {
  const registry = await readRegistry(registryFile, fs);
  registry.worktrees.push(entry);
  await writeRegistry(registryFile, registry, fs);
}

export async function removeWorktreeEntry(
  registryFile: string,
  name: string,
  fs: WorktreeFileSystem
): Promise<void> {
  const registry = await readRegistry(registryFile, fs);
  registry.worktrees = registry.worktrees.filter((w) => w.name !== name);
  await writeRegistry(registryFile, registry, fs);
}

export async function updateWorktreeStatus(
  registryFile: string,
  name: string,
  status: WorktreeStatus,
  deps: { fs: WorktreeFileSystem }
): Promise<void> {
  const { fs } = deps;
  const registry = await readRegistry(registryFile, fs);
  const entry = registry.worktrees.find((w) => w.name === name);
  if (!entry) {
    throw new Error(`Worktree "${name}" not found in registry`);
  }
  entry.status = status;
  await writeRegistry(registryFile, registry, fs);
}
