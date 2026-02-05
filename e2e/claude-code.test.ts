import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createContainer, setWorkspaceDir } from '@poe-code/e2e-docker-test-runner';
import type { Container } from '@poe-code/e2e-docker-test-runner';
import { join } from 'node:path';

const repoRoot = join(import.meta.dirname, '..');

describe('claude-code', () => {
  let container: Container;

  beforeAll(async () => {
    setWorkspaceDir(repoRoot);
    container = await createContainer({ testName: 'claude-code' });
    await container.login();
  });

  afterAll(async () => {
    await container?.destroy();
  });

  it('install', async () => {
    const result = await container.exec('poe-code install claude-code');
    expect(result).toHaveExitCode(0);
    const which = await container.exec('which claude');
    expect(which).toHaveExitCode(0);
  });

  it('configure', async () => {
    const result = await container.exec('poe-code configure claude-code --yes');
    expect(result).toHaveExitCode(0);

    await expect(container).toHaveFile('/root/.claude/settings.json');
    const raw = await container.readFile('/root/.claude/settings.json');
    const config = JSON.parse(raw);
    expect(config).toHaveProperty('apiKeyHelper');
    expect(config).toHaveProperty('env.ANTHROPIC_BASE_URL');
  });

  it('test', async () => {
    const result = await container.exec('poe-code test claude-code');
    expect(result).toSucceedWith('CLAUDE_CODE_OK');
  });
});

describe('claude-code isolated', () => {
  let container: Container;

  beforeAll(async () => {
    setWorkspaceDir(repoRoot);
    container = await createContainer({ testName: 'claude-code-isolated' });
    await container.login();
  });

  afterAll(async () => {
    await container?.destroy();
  });

  it('install', async () => {
    const result = await container.exec('poe-code install claude-code');
    expect(result).toHaveExitCode(0);
  });

  it('test --isolated', async () => {
    const result = await container.exec('poe-code test claude-code --isolated');
    expect(result).toSucceedWith('CLAUDE_CODE_OK');
  });
});
