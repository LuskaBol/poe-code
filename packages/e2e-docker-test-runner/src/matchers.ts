import { expect } from 'vitest';
import type { ExecResult, Container } from './types.js';

function formatExecContext(result: ExecResult): string {
  return [
    `  Exit code: ${result.exitCode}`,
    `  stdout: ${result.stdout || '(empty)'}`,
    `  stderr: ${result.stderr || '(empty)'}`,
  ].join('\n');
}

expect.extend({
  toHaveExitCode(received: ExecResult, expected: number) {
    const pass = received.exitCode === expected;
    return {
      pass,
      message: () =>
        pass
          ? `expected exit code not to be ${expected}\n${formatExecContext(received)}`
          : `expected exit code ${expected}, got ${received.exitCode}\n${formatExecContext(received)}`,
    };
  },

  toSucceedWith(received: ExecResult, text: string) {
    const exitCodeOk = received.exitCode === 0;
    const stdoutMatch = received.stdout.includes(text);
    const pass = exitCodeOk && stdoutMatch;
    return {
      pass,
      message: () => {
        if (pass) {
          return `expected command not to succeed with "${text}"\n${formatExecContext(received)}`;
        }
        const reasons: string[] = [];
        if (!exitCodeOk) reasons.push(`exit code was ${received.exitCode} (expected 0)`);
        if (!stdoutMatch) reasons.push(`stdout does not contain "${text}"`);
        return `expected command to succeed with "${text}"\n  ${reasons.join(', ')}\n${formatExecContext(received)}`;
      },
    };
  },

  toFail(received: ExecResult) {
    const pass = received.exitCode !== 0;
    return {
      pass,
      message: () =>
        pass
          ? `expected command not to fail\n${formatExecContext(received)}`
          : `expected command to fail but it exited with code 0\n${formatExecContext(received)}`,
    };
  },

  toFailWith(received: ExecResult, text: string) {
    const exitCodeFail = received.exitCode !== 0;
    const stderrMatch = received.stderr.includes(text);
    const pass = exitCodeFail && stderrMatch;
    return {
      pass,
      message: () => {
        if (pass) {
          return `expected command not to fail with "${text}"\n${formatExecContext(received)}`;
        }
        const reasons: string[] = [];
        if (!exitCodeFail) reasons.push('command succeeded (exit code 0)');
        if (!stderrMatch) reasons.push(`stderr does not contain "${text}"`);
        return `expected command to fail with "${text}"\n  ${reasons.join(', ')}\n${formatExecContext(received)}`;
      },
    };
  },

  toHaveStdout(received: ExecResult, matcher: string | RegExp) {
    const pass =
      typeof matcher === 'string'
        ? received.stdout.includes(matcher)
        : matcher.test(received.stdout);
    return {
      pass,
      message: () =>
        pass
          ? `expected stdout not to match ${matcher}\n${formatExecContext(received)}`
          : `expected stdout to match ${matcher}\n${formatExecContext(received)}`,
    };
  },

  toHaveStderr(received: ExecResult, matcher: string | RegExp) {
    const pass =
      typeof matcher === 'string'
        ? received.stderr.includes(matcher)
        : matcher.test(received.stderr);
    return {
      pass,
      message: () =>
        pass
          ? `expected stderr not to match ${matcher}\n${formatExecContext(received)}`
          : `expected stderr to match ${matcher}\n${formatExecContext(received)}`,
    };
  },

  async toHaveFile(received: Container, filePath: string) {
    const exists = await received.fileExists(filePath);
    return {
      pass: exists,
      message: () =>
        exists
          ? `expected container not to have file "${filePath}"`
          : `expected container to have file "${filePath}"`,
    };
  },

  async toHaveFileContaining(received: Container, filePath: string, text: string) {
    const exists = await received.fileExists(filePath);
    if (!exists) {
      return {
        pass: false,
        message: () =>
          `expected file "${filePath}" to contain "${text}", but file does not exist`,
      };
    }
    const content = await received.readFile(filePath);
    const pass = content.includes(text);
    return {
      pass,
      message: () =>
        pass
          ? `expected file "${filePath}" not to contain "${text}"\n  Content: ${content}`
          : `expected file "${filePath}" to contain "${text}"\n  Content: ${content}`,
    };
  },
});

declare module 'vitest' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface Assertion<T = unknown> {
    toHaveExitCode(code: number): void;
    toSucceedWith(text: string): void;
    toFail(): void;
    toFailWith(text: string): void;
    toHaveStdout(matcher: string | RegExp): void;
    toHaveStderr(matcher: string | RegExp): void;
    toHaveFile(path: string): Promise<void>;
    toHaveFileContaining(path: string, text: string): Promise<void>;
  }

  interface AsymmetricMatchersContaining {
    toHaveExitCode(code: number): void;
    toSucceedWith(text: string): void;
    toFail(): void;
    toFailWith(text: string): void;
    toHaveStdout(matcher: string | RegExp): void;
    toHaveStderr(matcher: string | RegExp): void;
  }
}
