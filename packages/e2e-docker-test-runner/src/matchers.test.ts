import { describe, it, expect, vi } from 'vitest';
import type { ExecResult, Container } from './types.js';
import './matchers.js';

function makeResult(overrides: Partial<ExecResult> = {}): ExecResult {
  return { exitCode: 0, stdout: '', stderr: '', ...overrides };
}

function makeContainer(overrides: Partial<Container> = {}): Container {
  return {
    id: 'test-container',
    destroy: vi.fn(),
    exec: vi.fn(),
    execOrThrow: vi.fn(),
    login: vi.fn(),
    fileExists: vi.fn().mockResolvedValue(false),
    readFile: vi.fn().mockResolvedValue(''),
    writeFile: vi.fn(),
    ...overrides,
  };
}

describe('toHaveExitCode', () => {
  it('passes when exit code matches', () => {
    expect(makeResult({ exitCode: 0 })).toHaveExitCode(0);
  });

  it('passes for non-zero exit code', () => {
    expect(makeResult({ exitCode: 42 })).toHaveExitCode(42);
  });

  it('fails when exit code does not match', () => {
    expect(() => {
      expect(makeResult({ exitCode: 1 })).toHaveExitCode(0);
    }).toThrow('expected exit code 0, got 1');
  });

  it('supports .not modifier', () => {
    expect(makeResult({ exitCode: 1 })).not.toHaveExitCode(0);
  });

  it('failure message includes full context', () => {
    expect(() => {
      expect(makeResult({ exitCode: 1, stdout: 'some output', stderr: 'some error' })).toHaveExitCode(0);
    }).toThrow(/stdout: some output/);
  });

  it('failure message includes command when present', () => {
    expect(() => {
      expect(makeResult({ exitCode: 1, command: 'poe-code install foo' })).toHaveExitCode(0);
    }).toThrow(/Command: poe-code install foo/);
  });
});

describe('toSucceedWith', () => {
  it('passes when exit code is 0 and stdout contains text', () => {
    expect(makeResult({ exitCode: 0, stdout: 'installed successfully' })).toSucceedWith('installed');
  });

  it('fails when exit code is non-zero', () => {
    expect(() => {
      expect(makeResult({ exitCode: 1, stdout: 'installed successfully' })).toSucceedWith('installed');
    }).toThrow('exit code was 1');
  });

  it('fails when stdout does not contain text', () => {
    expect(() => {
      expect(makeResult({ exitCode: 0, stdout: 'done' })).toSucceedWith('installed');
    }).toThrow('stdout does not contain "installed"');
  });

  it('fails with both reasons when both conditions fail', () => {
    expect(() => {
      expect(makeResult({ exitCode: 1, stdout: 'done' })).toSucceedWith('installed');
    }).toThrow(/exit code was 1/);
  });

  it('supports .not modifier', () => {
    expect(makeResult({ exitCode: 1, stdout: '' })).not.toSucceedWith('installed');
  });

  it('failure message includes full context', () => {
    expect(() => {
      expect(makeResult({ exitCode: 1, stdout: 'output', stderr: 'err' })).toSucceedWith('text');
    }).toThrow(/stderr: err/);
  });

  it('failure message includes command when present', () => {
    expect(() => {
      expect(makeResult({ exitCode: 1, stdout: 'output', command: 'poe-code test foo' })).toSucceedWith('text');
    }).toThrow(/Command: poe-code test foo/);
  });
});

describe('toFail', () => {
  it('passes when exit code is non-zero', () => {
    expect(makeResult({ exitCode: 1 })).toFail();
  });

  it('fails when exit code is 0', () => {
    expect(() => {
      expect(makeResult({ exitCode: 0 })).toFail();
    }).toThrow('expected command to fail but it exited with code 0');
  });

  it('supports .not modifier', () => {
    expect(makeResult({ exitCode: 0 })).not.toFail();
  });

  it('failure message includes full context', () => {
    expect(() => {
      expect(makeResult({ exitCode: 0, stdout: 'ok', stderr: '' })).toFail();
    }).toThrow(/stdout: ok/);
  });
});

describe('toFailWith', () => {
  it('passes when exit code is non-zero and stderr contains text', () => {
    expect(makeResult({ exitCode: 1, stderr: 'file not found' })).toFailWith('not found');
  });

  it('fails when exit code is 0', () => {
    expect(() => {
      expect(makeResult({ exitCode: 0, stderr: 'not found' })).toFailWith('not found');
    }).toThrow('command succeeded (exit code 0)');
  });

  it('fails when stderr does not contain text', () => {
    expect(() => {
      expect(makeResult({ exitCode: 1, stderr: 'permission denied' })).toFailWith('not found');
    }).toThrow('stderr does not contain "not found"');
  });

  it('supports .not modifier', () => {
    expect(makeResult({ exitCode: 0, stderr: '' })).not.toFailWith('error');
  });

  it('failure message includes full context', () => {
    expect(() => {
      expect(makeResult({ exitCode: 0, stdout: 'out', stderr: 'err' })).toFailWith('missing');
    }).toThrow(/stdout: out/);
  });
});

describe('toHaveStdout', () => {
  it('passes when stdout contains string', () => {
    expect(makeResult({ stdout: 'hello world' })).toHaveStdout('hello');
  });

  it('passes when stdout matches regex', () => {
    expect(makeResult({ stdout: 'version 1.2.3' })).toHaveStdout(/version \d+\.\d+\.\d+/);
  });

  it('fails when stdout does not contain string', () => {
    expect(() => {
      expect(makeResult({ stdout: 'hello' })).toHaveStdout('goodbye');
    }).toThrow('expected stdout to match goodbye');
  });

  it('fails when stdout does not match regex', () => {
    expect(() => {
      expect(makeResult({ stdout: 'no version here' })).toHaveStdout(/\d+\.\d+\.\d+/);
    }).toThrow(/expected stdout to match/);
  });

  it('supports .not modifier', () => {
    expect(makeResult({ stdout: 'hello' })).not.toHaveStdout('goodbye');
  });

  it('failure message includes full context', () => {
    expect(() => {
      expect(makeResult({ exitCode: 0, stdout: 'actual', stderr: 'errs' })).toHaveStdout('expected');
    }).toThrow(/stderr: errs/);
  });
});

describe('toHaveStderr', () => {
  it('passes when stderr contains string', () => {
    expect(makeResult({ stderr: 'warning: deprecated' })).toHaveStderr('warning');
  });

  it('passes when stderr matches regex', () => {
    expect(makeResult({ stderr: 'Error at line 42' })).toHaveStderr(/Error at line \d+/);
  });

  it('fails when stderr does not contain string', () => {
    expect(() => {
      expect(makeResult({ stderr: 'info' })).toHaveStderr('error');
    }).toThrow('expected stderr to match error');
  });

  it('fails when stderr does not match regex', () => {
    expect(() => {
      expect(makeResult({ stderr: 'no match' })).toHaveStderr(/\d+/);
    }).toThrow(/expected stderr to match/);
  });

  it('supports .not modifier', () => {
    expect(makeResult({ stderr: 'info' })).not.toHaveStderr('error');
  });

  it('failure message includes full context', () => {
    expect(() => {
      expect(makeResult({ exitCode: 1, stdout: 'out', stderr: 'actual' })).toHaveStderr('expected');
    }).toThrow(/stdout: out/);
  });
});

describe('toHaveFile', () => {
  it('passes when file exists', async () => {
    const container = makeContainer({
      fileExists: vi.fn().mockResolvedValue(true),
    });
    await expect(container).toHaveFile('/root/.config/settings.json');
  });

  it('fails when file does not exist', async () => {
    const container = makeContainer({
      fileExists: vi.fn().mockResolvedValue(false),
    });
    await expect(
      expect(container).toHaveFile('/root/.config/missing.json')
    ).rejects.toThrow('expected container to have file "/root/.config/missing.json"');
  });

  it('supports .not modifier', async () => {
    const container = makeContainer({
      fileExists: vi.fn().mockResolvedValue(false),
    });
    await expect(container).not.toHaveFile('/no/such/file');
  });

  it('calls fileExists with the correct path', async () => {
    const fileExists = vi.fn().mockResolvedValue(true);
    const container = makeContainer({ fileExists });
    await expect(container).toHaveFile('/specific/path');
    expect(fileExists).toHaveBeenCalledWith('/specific/path');
  });
});

describe('toHaveFileContaining', () => {
  it('passes when file exists and contains text', async () => {
    const container = makeContainer({
      fileExists: vi.fn().mockResolvedValue(true),
      readFile: vi.fn().mockResolvedValue('{"key": "value"}'),
    });
    await expect(container).toHaveFileContaining('/config.json', '"key"');
  });

  it('fails when file does not exist', async () => {
    const container = makeContainer({
      fileExists: vi.fn().mockResolvedValue(false),
    });
    await expect(
      expect(container).toHaveFileContaining('/missing.json', 'text')
    ).rejects.toThrow('file does not exist');
  });

  it('fails when file exists but does not contain text', async () => {
    const container = makeContainer({
      fileExists: vi.fn().mockResolvedValue(true),
      readFile: vi.fn().mockResolvedValue('other content'),
    });
    await expect(
      expect(container).toHaveFileContaining('/config.json', 'missing text')
    ).rejects.toThrow('expected file "/config.json" to contain "missing text"');
  });

  it('failure message includes file content', async () => {
    const container = makeContainer({
      fileExists: vi.fn().mockResolvedValue(true),
      readFile: vi.fn().mockResolvedValue('actual file content'),
    });
    await expect(
      expect(container).toHaveFileContaining('/config.json', 'missing')
    ).rejects.toThrow(/Content: actual file content/);
  });

  it('supports .not modifier', async () => {
    const container = makeContainer({
      fileExists: vi.fn().mockResolvedValue(true),
      readFile: vi.fn().mockResolvedValue('some content'),
    });
    await expect(container).not.toHaveFileContaining('/config.json', 'missing');
  });

  it('calls fileExists and readFile with the correct path', async () => {
    const fileExists = vi.fn().mockResolvedValue(true);
    const readFile = vi.fn().mockResolvedValue('content');
    const container = makeContainer({ fileExists, readFile });
    await expect(container).toHaveFileContaining('/specific/path', 'content');
    expect(fileExists).toHaveBeenCalledWith('/specific/path');
    expect(readFile).toHaveBeenCalledWith('/specific/path');
  });
});
