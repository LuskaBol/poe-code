import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createContainer, setWorkspaceDir } from '@poe-code/e2e-docker-test-runner';
import type { Container } from '@poe-code/e2e-docker-test-runner';
import { join } from 'node:path';

const repoRoot = join(import.meta.dirname, '..');

describe('opencode', () => {
  let container: Container;

  beforeAll(async () => {
    setWorkspaceDir(repoRoot);
    container = await createContainer({ testName: 'opencode' });
    await container.login();
  });

  afterAll(async () => {
    await container?.destroy();
  });

  it('install', async () => {
    const result = await container.exec('poe-code install opencode');
    expect(result).toHaveExitCode(0);
    const which = await container.exec('which opencode');
    expect(which).toHaveExitCode(0);
  });

  it('configure', async () => {
    const result = await container.exec('poe-code configure opencode --yes');
    expect(result).toHaveExitCode(0);

    await expect(container).toHaveFile('/root/.config/opencode/config.json');
    const raw = await container.readFile('/root/.config/opencode/config.json');
    const config = JSON.parse(raw);
    expect(config).toHaveProperty('model');
    expect(config).toHaveProperty('enabled_providers');

    await expect(container).toHaveFile('/root/.opencode-data/auth.json');
    const authRaw = await container.readFile('/root/.opencode-data/auth.json');
    const auth = JSON.parse(authRaw);
    expect(auth).toHaveProperty('poe.type');
    expect(auth).toHaveProperty('poe.key');
  });

  it('test', async () => {
    const result = await container.exec('poe-code test opencode');
    expect(result).toSucceedWith('OPEN_CODE_OK');
  });
});

describe('opencode isolated', () => {
  let container: Container;

  beforeAll(async () => {
    setWorkspaceDir(repoRoot);
    container = await createContainer({ testName: 'opencode-isolated' });
    await container.login();
  });

  afterAll(async () => {
    await container?.destroy();
  });

  it('install', async () => {
    const result = await container.exec('poe-code install opencode');
    expect(result).toHaveExitCode(0);
  });

  it('test --isolated', async () => {
    const result = await container.exec('poe-code test opencode --isolated');
    expect(result).toSucceedWith('OPEN_CODE_OK');
  });
});
