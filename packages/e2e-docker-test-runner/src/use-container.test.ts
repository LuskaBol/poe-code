import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./persistent-container.js');
vi.mock('./container.js');

import { createContainer } from './persistent-container.js';
import { setWorkspaceDir } from './container.js';
import { useContainer } from './use-container.js';
import type { Container } from './types.js';

function makeMockContainer(): Container {
  return {
    id: 'test-123',
    destroy: vi.fn(),
    exec: vi.fn().mockResolvedValue({ exitCode: 0, stdout: '', stderr: '' }),
    execOrThrow: vi.fn().mockResolvedValue({ exitCode: 0, stdout: '', stderr: '' }),
    login: vi.fn(),
    fileExists: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn(),
  };
}

describe('useContainer', () => {
  let mockContainer: Container;

  beforeEach(() => {
    vi.clearAllMocks();
    mockContainer = makeMockContainer();
    vi.mocked(createContainer).mockResolvedValue(mockContainer);
  });

  describe('lifecycle', () => {
    const container = useContainer({ workspaceDir: '/test', testName: 'my-agent' });

    it('sets workspace dir', () => {
      expect(setWorkspaceDir).toHaveBeenCalledWith('/test');
    });

    it('creates container with testName', () => {
      expect(createContainer).toHaveBeenCalledWith({ testName: 'my-agent' });
    });

    it('logs in', () => {
      expect(mockContainer.login).toHaveBeenCalled();
    });

    it('delegates exec to container', async () => {
      vi.mocked(mockContainer.exec).mockResolvedValue({ exitCode: 0, stdout: 'hello', stderr: '' });
      const result = await container.exec('echo hello');
      expect(mockContainer.exec).toHaveBeenCalledWith('echo hello');
      expect(result.stdout).toBe('hello');
    });

    it('exposes container id', () => {
      expect(container.id).toBe('test-123');
    });

    it('creates a fresh container for each test', () => {
      expect(vi.mocked(createContainer)).toHaveBeenCalledTimes(1);
    });
  });
});
