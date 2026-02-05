import { describe, it, expect, vi, beforeEach } from 'vitest';
import { vol } from 'memfs';
import { buildCreateArgs, buildExecArgs, CONTAINER_PATH } from './persistent-container.js';
import { MOUNT_TARGET } from './container.js';

vi.mock('node:fs', async () => {
  const memfs = await import('memfs');
  return memfs.fs;
});

vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
  spawnSync: vi.fn(),
}));

vi.mock('./engine.js', () => ({
  detectEngine: vi.fn(() => 'docker'),
}));

vi.mock('./image.js', () => ({
  ensureImage: vi.fn(() => 'poe-code-e2e:abc123'),
  IMAGE_NAME: 'poe-code-e2e',
}));

vi.mock('./credentials.js', () => ({
  getApiKey: vi.fn(() => 'test-api-key'),
}));

vi.mock('node:crypto', async (importOriginal) => {
  const original = await importOriginal<typeof import('node:crypto')>();
  return {
    ...original,
    randomUUID: vi.fn(() => 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
  };
});

describe('buildCreateArgs', () => {
  const baseConfig = {
    name: 'poe-e2e-a1b2c3d4',
    mountSource: '/workspace',
    npmCacheDir: '/cache/npm',
    uvCacheDir: '/cache/uv',
    localBinDir: '/cache/local',
    apiKey: null as string | null,
    image: 'poe-code-e2e:abc123',
  };

  it('starts with docker create', () => {
    const args = buildCreateArgs(baseConfig);
    expect(args[0]).toBe('create');
  });

  it('sets container name', () => {
    const args = buildCreateArgs(baseConfig);
    const nameIndex = args.indexOf('--name');
    expect(nameIndex).toBeGreaterThan(-1);
    expect(args[nameIndex + 1]).toBe('poe-e2e-a1b2c3d4');
  });

  it('adds poe-e2e-test-runner label', () => {
    const args = buildCreateArgs(baseConfig);
    const labelIndex = args.indexOf('--label');
    expect(labelIndex).toBeGreaterThan(-1);
    expect(args[labelIndex + 1]).toBe('poe-e2e-test-runner=true');
  });

  it('mounts workspace to container', () => {
    const args = buildCreateArgs(baseConfig);
    expect(args).toContain(`/workspace:${MOUNT_TARGET}:rw`);
  });

  it('mounts cache directories', () => {
    const args = buildCreateArgs(baseConfig);
    expect(args).toContain('/cache/npm:/root/.npm:rw');
    expect(args).toContain('/cache/uv:/root/.cache/uv:rw');
    expect(args).toContain('/cache/local:/root/.local:rw');
  });

  it('sets working directory', () => {
    const args = buildCreateArgs(baseConfig);
    const wIndex = args.indexOf('-w');
    expect(wIndex).toBeGreaterThan(-1);
    expect(args[wIndex + 1]).toBe(MOUNT_TARGET);
  });

  it('includes image and sleep command', () => {
    const args = buildCreateArgs(baseConfig);
    expect(args).toContain('poe-code-e2e:abc123');
    expect(args).toContain('sleep');
    expect(args).toContain('86400');
  });

  it('adds env vars when apiKey is provided', () => {
    const args = buildCreateArgs({ ...baseConfig, apiKey: 'test-key' });
    expect(args).toContain('-e');
    expect(args).toContain('POE_API_KEY');
    expect(args).toContain('POE_CODE_STDERR_LOGS=1');
  });

  it('does not add env vars when apiKey is null', () => {
    const args = buildCreateArgs(baseConfig);
    expect(args).not.toContain('POE_API_KEY');
  });

  it('always sets PATH env for local bins and uv', () => {
    const args = buildCreateArgs(baseConfig);
    expect(args).toContain(`PATH=${CONTAINER_PATH}`);
  });
});

describe('buildExecArgs', () => {
  it('constructs docker exec with sh -c', () => {
    const args = buildExecArgs('abc123', 'echo hello');
    expect(args).toEqual(['exec', 'abc123', 'sh', '-c', 'echo hello']);
  });

  it('passes command as single sh -c argument', () => {
    const args = buildExecArgs('cid', 'ls -la /root && cat /etc/hosts');
    expect(args[3]).toBe('-c');
    expect(args[4]).toBe('ls -la /root && cat /etc/hosts');
  });
});

describe('createContainer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vol.reset();
    // Ensure cache dirs exist in memfs
    vol.mkdirSync('/tmp', { recursive: true });
  });

  it('calls docker create with correct args and docker start', async () => {
    const { spawnSync } = await import('node:child_process');
    const mockSpawnSync = vi.mocked(spawnSync);

    mockSpawnSync.mockImplementation((_cmd, args) => {
      const argsArr = args as string[];
      if (argsArr[0] === 'create') {
        return {
          status: 0,
          stdout: 'abc123containerid\n',
          stderr: '',
          pid: 1,
          output: [],
          signal: null,
        };
      }
      if (argsArr[0] === 'start') {
        return {
          status: 0,
          stdout: '',
          stderr: '',
          pid: 1,
          output: [],
          signal: null,
        };
      }
      return {
        status: 0,
        stdout: '',
        stderr: '',
        pid: 1,
        output: [],
        signal: null,
      };
    });

    const { createContainer } = await import('./persistent-container.js');
    const container = await createContainer({ image: 'poe-code-e2e:abc123' });

    expect(container.id).toBe('abc123containerid');

    // Verify docker create was called
    const createCall = mockSpawnSync.mock.calls.find(
      (call) => (call[1] as string[])[0] === 'create'
    );
    expect(createCall).toBeDefined();
    expect(createCall![0]).toBe('docker');
    const createArgs = createCall![1] as string[];
    expect(createArgs).toContain('--name');
    expect(createArgs).toContain('--label');
    expect(createArgs).toContain('poe-e2e-test-runner=true');

    // Container name matches poe-e2e-<uuid-short> pattern
    const nameIndex = createArgs.indexOf('--name');
    expect(createArgs[nameIndex + 1]).toBe('poe-e2e-a1b2c3d4');

    // Verify docker start was called with the container ID
    const startCall = mockSpawnSync.mock.calls.find(
      (call) => (call[1] as string[])[0] === 'start'
    );
    expect(startCall).toBeDefined();
    expect(startCall![0]).toBe('docker');
    expect((startCall![1] as string[])[1]).toBe('abc123containerid');
  });

  it('throws when docker create fails', async () => {
    const { spawnSync } = await import('node:child_process');
    vi.mocked(spawnSync).mockReturnValue({
      status: 1,
      stdout: '',
      stderr: 'create failed',
      pid: 1,
      output: [],
      signal: null,
    });

    const { createContainer } = await import('./persistent-container.js');
    await expect(createContainer({ image: 'poe-code-e2e:abc123' })).rejects.toThrow(
      'Failed to create container: create failed'
    );
  });

  it('throws and cleans up when docker start fails', async () => {
    const { spawnSync } = await import('node:child_process');
    const mockSpawnSync = vi.mocked(spawnSync);

    mockSpawnSync.mockImplementation((_cmd, args) => {
      const argsArr = args as string[];
      if (argsArr[0] === 'create') {
        return {
          status: 0,
          stdout: 'abc123containerid\n',
          stderr: '',
          pid: 1,
          output: [],
          signal: null,
        };
      }
      if (argsArr[0] === 'start') {
        return {
          status: 1,
          stdout: '',
          stderr: 'start failed',
          pid: 1,
          output: [],
          signal: null,
        };
      }
      // rm -f cleanup
      return {
        status: 0,
        stdout: '',
        stderr: '',
        pid: 1,
        output: [],
        signal: null,
      };
    });

    const { createContainer } = await import('./persistent-container.js');
    await expect(createContainer({ image: 'poe-code-e2e:abc123' })).rejects.toThrow(
      'Failed to start container: start failed'
    );

    // Verify cleanup rm -f was called
    const rmCall = mockSpawnSync.mock.calls.find(
      (call) => (call[1] as string[])[0] === 'rm'
    );
    expect(rmCall).toBeDefined();
    expect((rmCall![1] as string[])).toEqual(['rm', '-f', 'abc123containerid']);
  });
});

describe('destroy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vol.reset();
  });

  it('calls docker rm -f with container id', async () => {
    const { spawnSync } = await import('node:child_process');
    const mockSpawnSync = vi.mocked(spawnSync);

    mockSpawnSync.mockImplementation((_cmd, args) => {
      const argsArr = args as string[];
      if (argsArr[0] === 'create') {
        return {
          status: 0,
          stdout: 'my-container-id\n',
          stderr: '',
          pid: 1,
          output: [],
          signal: null,
        };
      }
      return {
        status: 0,
        stdout: '',
        stderr: '',
        pid: 1,
        output: [],
        signal: null,
      };
    });

    const { createContainer } = await import('./persistent-container.js');
    const container = await createContainer({ image: 'poe-code-e2e:abc123' });

    mockSpawnSync.mockClear();

    await container.destroy();

    expect(mockSpawnSync).toHaveBeenCalledWith(
      'docker',
      ['rm', '-f', 'my-container-id'],
      { stdio: 'ignore' }
    );
  });
});

function setupContainerMock() {
  return async () => {
    const { spawnSync } = await import('node:child_process');
    const mockSpawnSync = vi.mocked(spawnSync);

    mockSpawnSync.mockImplementation((_cmd, args) => {
      const argsArr = args as string[];
      if (argsArr[0] === 'create') {
        return {
          status: 0,
          stdout: 'test-container-id\n',
          stderr: '',
          pid: 1,
          output: [],
          signal: null,
        };
      }
      return {
        status: 0,
        stdout: '',
        stderr: '',
        pid: 1,
        output: [],
        signal: null,
      };
    });

    const { createContainer } = await import('./persistent-container.js');
    const container = await createContainer({ image: 'poe-code-e2e:abc123' });
    mockSpawnSync.mockClear();

    return { container, mockSpawnSync };
  };
}

describe('exec', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vol.reset();
  });

  it('calls docker exec with sh -c and the command', async () => {
    const { container, mockSpawnSync } = await setupContainerMock()();

    mockSpawnSync.mockReturnValue({
      status: 0,
      stdout: 'hello\n',
      stderr: '',
      pid: 1,
      output: [],
      signal: null,
    });

    await container.exec('echo hello');

    expect(mockSpawnSync).toHaveBeenCalledWith(
      'docker',
      ['exec', 'test-container-id', 'sh', '-c', 'echo hello'],
      { encoding: 'utf-8', stdio: 'pipe' }
    );
  });

  it('returns trimmed stdout and stderr', async () => {
    const { container, mockSpawnSync } = await setupContainerMock()();

    mockSpawnSync.mockReturnValue({
      status: 0,
      stdout: '  output with spaces  \n',
      stderr: '  some warning  \n',
      pid: 1,
      output: [],
      signal: null,
    });

    const result = await container.exec('some-command');

    expect(result).toEqual({
      exitCode: 0,
      stdout: 'output with spaces',
      stderr: 'some warning',
    });
  });

  it('returns non-zero exit code without throwing', async () => {
    const { container, mockSpawnSync } = await setupContainerMock()();

    mockSpawnSync.mockReturnValue({
      status: 42,
      stdout: '',
      stderr: 'command not found\n',
      pid: 1,
      output: [],
      signal: null,
    });

    const result = await container.exec('bad-command');

    expect(result.exitCode).toBe(42);
    expect(result.stderr).toBe('command not found');
  });

  it('defaults exitCode to 1 when status is null', async () => {
    const { container, mockSpawnSync } = await setupContainerMock()();

    mockSpawnSync.mockReturnValue({
      status: null,
      stdout: '',
      stderr: '',
      pid: 1,
      output: [],
      signal: 'SIGTERM',
    });

    const result = await container.exec('killed-command');

    expect(result.exitCode).toBe(1);
  });

  it('handles null stdout/stderr gracefully', async () => {
    const { container, mockSpawnSync } = await setupContainerMock()();

    mockSpawnSync.mockReturnValue({
      status: 0,
      stdout: null as unknown as string,
      stderr: null as unknown as string,
      pid: 1,
      output: [],
      signal: null,
    });

    const result = await container.exec('some-command');

    expect(result.stdout).toBe('');
    expect(result.stderr).toBe('');
  });
});

describe('execOrThrow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vol.reset();
  });

  it('returns result on exit code 0', async () => {
    const { container, mockSpawnSync } = await setupContainerMock()();

    mockSpawnSync.mockReturnValue({
      status: 0,
      stdout: 'success output\n',
      stderr: '',
      pid: 1,
      output: [],
      signal: null,
    });

    const result = await container.execOrThrow('echo ok');

    expect(result).toEqual({
      exitCode: 0,
      stdout: 'success output',
      stderr: '',
    });
  });

  it('throws on non-zero exit code with command, code, and stderr', async () => {
    const { container, mockSpawnSync } = await setupContainerMock()();

    mockSpawnSync.mockReturnValue({
      status: 127,
      stdout: '',
      stderr: 'sh: bad-cmd: not found\n',
      pid: 1,
      output: [],
      signal: null,
    });

    await expect(container.execOrThrow('bad-cmd')).rejects.toThrow(
      'Command failed: "bad-cmd" (exit code 127)'
    );
    await expect(container.execOrThrow('bad-cmd')).rejects.toThrow(
      'sh: bad-cmd: not found'
    );
  });
});
