import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createContainer, setWorkspaceDir } from '@poe-code/e2e-docker-test-runner';
import type { Container } from '@poe-code/e2e-docker-test-runner';
import { join } from 'node:path';

const repoRoot = join(import.meta.dirname, '..');

describe('codex', () => {
  let container: Container;

  beforeAll(async () => {
    setWorkspaceDir(repoRoot);
    container = await createContainer({ testName: 'codex' });
    await container.login();
  });

  afterAll(async () => {
    await container?.destroy();
  });

  it('install', async () => {
    const result = await container.exec('poe-code install codex');
    expect(result).toHaveExitCode(0);
    const which = await container.exec('which codex');
    expect(which).toHaveExitCode(0);
  });

  it('configure', async () => {
    const result = await container.exec('poe-code configure codex --yes');
    expect(result).toHaveExitCode(0);

    await expect(container).toHaveFile('/root/.codex/config.toml');
    const config = await container.readFile('/root/.codex/config.toml');
    expect(config).toContain('model_provider');
    expect(config).toContain('base_url');
  });

  it('test', async () => {
    const result = await container.exec('poe-code test codex');
    expect(result).toSucceedWith('CODEX_OK');
  });
});

describe('codex isolated', () => {
  let container: Container;

  beforeAll(async () => {
    setWorkspaceDir(repoRoot);
    container = await createContainer({ testName: 'codex-isolated' });
    await container.login();
  });

  afterAll(async () => {
    await container?.destroy();
  });

  it('install', async () => {
    const result = await container.exec('poe-code install codex');
    expect(result).toHaveExitCode(0);
  });

  it('test --isolated', async () => {
    const result = await container.exec('poe-code test codex --isolated');
    expect(result).toSucceedWith('CODEX_OK');
  });
});
