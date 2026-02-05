import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createContainer, setWorkspaceDir } from '@poe-code/e2e-docker-test-runner';
import type { Container } from '@poe-code/e2e-docker-test-runner';
import { join } from 'node:path';

const repoRoot = join(import.meta.dirname, '..');

describe('kimi', () => {
  let container: Container;

  beforeAll(async () => {
    setWorkspaceDir(repoRoot);
    container = await createContainer({ testName: 'kimi' });
    await container.login();
  });

  afterAll(async () => {
    await container?.destroy();
  });

  it('install', async () => {
    const result = await container.exec('poe-code install kimi');
    expect(result).toHaveExitCode(0);
    const which = await container.exec('which kimi');
    expect(which).toHaveExitCode(0);
  });

  it('configure', async () => {
    const result = await container.exec('poe-code configure kimi --yes');
    expect(result).toHaveExitCode(0);

    await expect(container).toHaveFile('/root/.kimi/config.toml');
    const config = await container.readFile('/root/.kimi/config.toml');
    expect(config).toContain('default_model');
    expect(config).toContain('base_url');
    expect(config).toContain('api_key');
  });

  it('test', async () => {
    const result = await container.exec('poe-code test kimi');
    expect(result).toSucceedWith('KIMI_OK');
  });
});

describe('kimi isolated', () => {
  let container: Container;

  beforeAll(async () => {
    setWorkspaceDir(repoRoot);
    container = await createContainer({ testName: 'kimi-isolated' });
    await container.login();
  });

  afterAll(async () => {
    await container?.destroy();
  });

  it('install', async () => {
    const result = await container.exec('poe-code install kimi');
    expect(result).toHaveExitCode(0);
  });

  it('test --isolated', async () => {
    const result = await container.exec('poe-code test kimi --isolated');
    expect(result).toSucceedWith('KIMI_OK');
  });
});
