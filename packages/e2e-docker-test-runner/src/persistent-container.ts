import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import type { Container, ContainerOptions, ExecResult } from './types.js';
import { detectEngine } from './engine.js';
import { ensureImage } from './image.js';
import { getApiKey } from './credentials.js';
import {
  MOUNT_TARGET,
  NPM_CACHE_DIR,
  UV_CACHE_DIR,
  LOCAL_BIN_DIR,
  getWorkspaceDir,
} from './container.js';
import { mkdirSync, existsSync } from 'node:fs';

const CONTAINER_LABEL = 'poe-e2e-test-runner=true';
export const CONTAINER_PATH = '/root/.local/bin:/root/.claude/local/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin';

function ensureCacheDirs(): void {
  for (const dir of [NPM_CACHE_DIR, UV_CACHE_DIR, LOCAL_BIN_DIR]) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }
}

function generateContainerName(): string {
  return `poe-e2e-${randomUUID().split('-')[0]}`;
}

export function buildCreateArgs(config: {
  name: string;
  mountSource: string;
  npmCacheDir: string;
  uvCacheDir: string;
  localBinDir: string;
  apiKey: string | null;
  image: string;
}): string[] {
  const args: string[] = [
    'create',
    '--name', config.name,
    '--label', CONTAINER_LABEL,
    '-v', `${config.mountSource}:${MOUNT_TARGET}:rw`,
    '-v', `${config.npmCacheDir}:/root/.npm:rw`,
    '-v', `${config.uvCacheDir}:/root/.cache/uv:rw`,
    '-v', `${config.localBinDir}:/root/.local:rw`,
    '-w', MOUNT_TARGET,
  ];

  args.push('-e', `PATH=${CONTAINER_PATH}`);

  if (config.apiKey) {
    args.push('-e', 'POE_API_KEY');
    args.push('-e', 'POE_CODE_STDERR_LOGS=1');
  }

  args.push(config.image, 'sleep', '86400');

  return args;
}

export function buildExecArgs(containerId: string, command: string): string[] {
  return ['exec', containerId, 'sh', '-c', command];
}

export async function createContainer(options: ContainerOptions = {}): Promise<Container> {
  const workspace = getWorkspaceDir() ?? process.cwd();
  ensureCacheDirs();

  const engine = detectEngine();
  const image = options.image ?? ensureImage(engine, workspace);
  const apiKey = getApiKey();
  const name = generateContainerName();

  const createArgs = buildCreateArgs({
    name,
    mountSource: workspace,
    npmCacheDir: NPM_CACHE_DIR,
    uvCacheDir: UV_CACHE_DIR,
    localBinDir: LOCAL_BIN_DIR,
    apiKey,
    image,
  });

  const env = { ...process.env };
  if (apiKey) {
    env.POE_API_KEY = apiKey;
  }

  const createResult = spawnSync(engine, createArgs, {
    encoding: 'utf-8',
    env,
  });

  if (createResult.status !== 0) {
    throw new Error(`Failed to create container: ${createResult.stderr}`);
  }

  const containerId = createResult.stdout.trim();

  const startResult = spawnSync(engine, ['start', containerId], {
    encoding: 'utf-8',
  });

  if (startResult.status !== 0) {
    // Clean up the created container on start failure
    spawnSync(engine, ['rm', '-f', containerId], { stdio: 'ignore' });
    throw new Error(`Failed to start container: ${startResult.stderr}`);
  }

  const exec = async (command: string): Promise<ExecResult> => {
    const execArgs = buildExecArgs(containerId, command);
    const result = spawnSync(engine, execArgs, {
      encoding: 'utf-8',
      stdio: 'pipe',
    });
    return {
      exitCode: result.status ?? 1,
      stdout: (result.stdout ?? '').trim(),
      stderr: (result.stderr ?? '').trim(),
    };
  };

  return {
    id: containerId,

    destroy: async () => {
      spawnSync(engine, ['rm', '-f', containerId], { stdio: 'ignore' });
    },

    exec,

    async execOrThrow(command: string): Promise<ExecResult> {
      const result = await exec(command);
      if (result.exitCode !== 0) {
        throw new Error(
          `Command failed: "${command}" (exit code ${result.exitCode})\n${result.stderr}`
        );
      }
      return result;
    },

    async login(): Promise<void> {
      throw new Error('Not implemented — see US-005');
    },

    async fileExists(filePath: string): Promise<boolean> {
      const result = await exec(`test -f ${filePath}`);
      return result.exitCode === 0;
    },

    async readFile(filePath: string): Promise<string> {
      const result = await exec(`cat ${filePath}`);
      if (result.exitCode !== 0) {
        throw new Error(
          `Failed to read file "${filePath}": ${result.stderr}`
        );
      }
      return result.stdout;
    },

    async writeFile(filePath: string, content: string): Promise<void> {
      const result = spawnSync(engine, ['exec', '-i', containerId, 'sh', '-c', `cat > ${filePath}`], {
        encoding: 'utf-8',
        input: content,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      if ((result.status ?? 1) !== 0) {
        throw new Error(
          `Failed to write file "${filePath}": ${(result.stderr ?? '').trim()}`
        );
      }
    },
  };
}
