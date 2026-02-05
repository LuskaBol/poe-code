/**
 * Spike: persistent container via docker exec (US-001)
 *
 * Validates that `docker create` + `docker start` + `docker exec` works
 * reliably for interactive per-command execution. This is the foundation
 * for the Container API — instead of running all commands in a single
 * `docker run --rm` invocation, we keep a container alive and exec into it.
 *
 * Findings (documented in-test via console.log):
 * - docker exec reuses the running container with no startup overhead
 * - State persists: files created in one exec are visible in the next
 * - Environment is isolated: exported variables in one exec don't leak to the next
 * - Overhead per exec call is measured and logged (typically ~50-200ms on macOS)
 *
 * These properties confirm docker exec is suitable for the interactive Container API.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync, spawnSync } from 'node:child_process';

const SPIKE_IMAGE = 'alpine:latest';

function isDockerAvailable(): boolean {
  try {
    execSync('docker info', { stdio: 'ignore', timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

const dockerAvailable = isDockerAvailable();

describe.skipIf(!dockerAvailable)('docker exec spike (US-001)', () => {
  let containerId: string;

  beforeAll(() => {
    // Pull image if not already cached
    spawnSync('docker', ['pull', '-q', SPIKE_IMAGE], { stdio: 'ignore' });

    // docker create — returns container ID without starting it
    const createResult = spawnSync('docker', ['create', SPIKE_IMAGE, 'sleep', '3600'], {
      encoding: 'utf-8',
    });
    expect(createResult.status).toBe(0);
    containerId = createResult.stdout.trim();

    // docker start — starts the created container in the background
    const startResult = spawnSync('docker', ['start', containerId], {
      encoding: 'utf-8',
    });
    expect(startResult.status).toBe(0);
  });

  afterAll(() => {
    if (containerId) {
      spawnSync('docker', ['rm', '-f', containerId], { stdio: 'ignore' });
    }
  });

  it('exec overhead: time 10 sequential docker exec calls', () => {
    const times: number[] = [];

    for (let i = 0; i < 10; i++) {
      const start = performance.now();
      const result = spawnSync('docker', ['exec', containerId, 'echo', 'ping'], {
        encoding: 'utf-8',
      });
      const elapsed = performance.now() - start;
      times.push(elapsed);

      expect(result.status).toBe(0);
      expect(result.stdout.trim()).toBe('ping');
    }

    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const min = Math.min(...times);
    const max = Math.max(...times);

    console.log('\n--- Docker exec overhead (10 sequential calls) ---');
    console.log(`Average: ${avg.toFixed(1)}ms`);
    console.log(`Min: ${min.toFixed(1)}ms, Max: ${max.toFixed(1)}ms`);
    console.log(`Times: [${times.map((t) => t.toFixed(1)).join(', ')}]ms`);
    console.log('---');

    // Each exec should complete well under 5 seconds
    expect(max).toBeLessThan(5000);
  });

  it('state persists: touch /tmp/foo then test -f /tmp/foo returns 0', () => {
    const touchResult = spawnSync('docker', ['exec', containerId, 'touch', '/tmp/foo'], {
      encoding: 'utf-8',
    });
    expect(touchResult.status).toBe(0);

    const testResult = spawnSync('docker', ['exec', containerId, 'test', '-f', '/tmp/foo'], {
      encoding: 'utf-8',
    });
    expect(testResult.status).toBe(0);
  });

  it('environment isolation: export X=1 then echo $X returns empty', () => {
    const exportResult = spawnSync(
      'docker',
      ['exec', containerId, 'sh', '-c', 'export X=1'],
      { encoding: 'utf-8' },
    );
    expect(exportResult.status).toBe(0);

    const echoResult = spawnSync(
      'docker',
      ['exec', containerId, 'sh', '-c', 'echo "$X"'],
      { encoding: 'utf-8' },
    );
    expect(echoResult.status).toBe(0);
    expect(echoResult.stdout.trim()).toBe('');
  });
});
