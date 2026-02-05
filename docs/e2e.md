# E2E Test Library — Investigation & Design

## Problem

The current `@poe-code/e2e-docker-test-runner` runs all commands in a single
`docker run` and checks only the final exit code. When a test fails, you get
no signal about *which* command failed, *what* it printed, or *what files* it
left behind. The API is batch-oriented — you hand it a list of strings and get
back a number.

```typescript
// Current: opaque batch
const result = runInContainer([
  login(),
  'poe-code install codex',
  'poe-code configure codex --yes',
  'poe-code test codex',
]);
expect(result.exitCode).toBe(0); // that's it — which step failed?
```

---

## Analysis Lenses

### Developer using the library

**Pain today:**
- Can't assert intermediate state (stdout after install, files after configure)
- When a test fails, have to read a raw log dump to find the cause
- Every agent test file is copy-pasted boilerplate — 4 identical files
- `login()` returns a string with shell-escaped credentials — leaky abstraction

**What good looks like:**
- Each command is one `await` call returning structured output
- Custom matchers make assertions read like English
- Filesystem inspection without shell escaping: `container.readFile(path)`
- Container lifecycle in standard vitest hooks — no magic

### Maintainer

**Pain today:**
- `runInContainer` is a 60-line function mixing Docker orchestration, Colima
  detection, image building, mount setup, and command execution in one place
- Adding a new assertion type (e.g. file check) means changing the monolith
- `types.ts` already defines a `Container` interface that nothing implements
- `runner.ts` (standalone CLI) duplicates the command lists from the test files

**What good looks like:**
- Clear separation: image management, container lifecycle, command execution
- `Container` interface as the single public API — everything else is internal
- New assertion needs = new method on Container, tested in isolation
- Runner delegates to the same Container API

### Speed

**Current performance profile:**
- Docker image build: ~30-60s (cached by source hash — rarely rebuilds)
- Container startup (`docker run`): ~1-2s per invocation
- Actual commands: ~20-40s per agent (network-bound: install downloads binaries)
- Total per agent: ~25-45s
- Total suite (4 agents x 2 flows, serial): ~4-6 minutes

**Impact of persistent containers:**
- `docker create` + `docker start`: ~1-2s (one-time per describe block)
- `docker exec` per command: ~50-100ms overhead (just IPC, no container startup)
- Net change: eliminate ~1-2s startup per `it()` block, add ~50ms exec overhead
- Roughly neutral for total time, but enables finer-grained test structure

**Key insight:** The bottleneck is network I/O (downloading agent binaries), not
Docker overhead. Switching to persistent containers does not slow anything down
but unlocks per-command assertions.

### Publishing as a library

If `@poe-code/e2e-docker-test-runner` were a standalone npm package:

**Must have:**
- Clean, minimal public API (`createContainer`, `Container` interface)
- Zero coupling to poe-code internals (login is poe-specific, so it's opt-in)
- Types exported, JSDoc on public methods
- Works with any Docker image, not just poe-code-e2e
- Custom vitest matchers as a separate entrypoint (e.g. `@poe-code/e2e-docker-test-runner/matchers`)

**Nice to have:**
- Builder pattern for container config (like testcontainers)
- Pluggable engine detection (docker/podman)
- Vitest integration helper (globalSetup factory)

**Current blockers:**
- `login()` is poe-code-specific — fine as a convenience, but the core API
  (create, exec, readFile, destroy) should be generic
- Colima/Podman detection is tightly wired — needs to be a strategy, not hardcoded
- Image hash computation assumes poe-code file structure

---

## Investigation Steps

### Step 1: Validate docker exec approach

**Question:** Does `docker create` + `docker start` + `docker exec` behave
reliably for sequential test steps? What's the per-exec overhead?

**Approach:**
```bash
# Create and start a persistent container
ID=$(docker create -it poe-code-e2e:latest sh -c 'sleep infinity')
docker start $ID

# Measure exec overhead (10 calls)
time for i in $(seq 1 10); do docker exec $ID echo "ping $i"; done

# Confirm state persistence
docker exec $ID touch /tmp/marker
docker exec $ID test -f /tmp/marker && echo "PERSISTED" || echo "LOST"

# Confirm env isolation per exec
docker exec $ID sh -c 'export X=42'
docker exec $ID sh -c 'echo "X=$X"'   # should be empty

# Cleanup
docker rm -f $ID
```

**What to measure:**
- Wall clock per exec call (expect ~50-100ms)
- Whether `/root` state accumulates correctly across execs
- Whether cache mounts (npm, uv) work with `docker create -v` same as `docker run -v`

**Acceptance:** Exec overhead < 200ms. State persists. Cache mounts work.

---

### Step 2: Design the Container API shape

**Question:** What's the most elegant, readable API for test authors?

**Candidates evaluated:**

#### Option A: Minimal (current types.ts) — RECOMMENDED

```typescript
const container = await createContainer();
await container.login();

const result = await container.exec('poe-code install codex');
expect(result.exitCode).toBe(0);
expect(result.stdout).toContain('installed');

const config = await container.readFile('/root/.codex/config.json');
expect(JSON.parse(config)).toMatchObject({ model: 'gpt-4o' });

await container.destroy();
```

Pros: Simple. Matches `types.ts` already. Familiar.
Cons: No builder pattern. Options passed to factory function.

#### Option B: Builder pattern (testcontainers-style)

```typescript
const container = await new TestContainer('poe-code-e2e')
  .withEnv({ POE_API_KEY: key })
  .withMount('/workspace', repoRoot)
  .start();

const { stdout, exitCode } = await container.exec(['poe-code', 'install', 'codex']);
```

Pros: Flexible. Familiar to testcontainers users. Discoverable.
Cons: Heavier API surface. `exec` takes array (less ergonomic for shell commands).
Not aligned with existing codebase style.

#### Option C: Functional with presets

```typescript
const container = await createContainer({
  image: 'poe-code-e2e',
  preset: 'poe-code',
});
const result = await container.exec('poe-code install codex');
```

Pros: Preset handles poe-specific setup. Core is generic.
Cons: `preset` is an implicit behavior switch — harder to understand.

**Decision:** Option A. It matches what's already in `types.ts`, is the
simplest, and avoids over-engineering. A builder can wrap the factory later
without breaking existing tests.

---

### Step 3: Design custom vitest matchers

**Question:** What matchers make e2e assertions maximally readable?

#### ExecResult matchers

```typescript
// Instead of:
expect(result.exitCode).toBe(0);
expect(result.stdout).toContain('installed');

// Write:
expect(result).toHaveExitCode(0);
expect(result).toHaveStdout(expect.stringContaining('installed'));
expect(result).toHaveStderr('');

// Or for the common case (exit 0 + stdout check):
expect(result).toSucceedWith('installed');

// Failure case with good diagnostics:
expect(result).toHaveExitCode(0);
// AssertionError: Expected exit code 0, got 1
//   stdout: "..."
//   stderr: "Error: codex not found"
//   command: "poe-code install codex"
```

#### Container file matchers

```typescript
// Instead of:
const exists = await container.fileExists('/root/.codex/config.json');
expect(exists).toBe(true);

// Write:
await expect(container).toHaveFile('/root/.codex/config.json');
await expect(container).toHaveFileContaining('/root/.codex/config.json', '"model"');
await expect(container).toHaveFileMatching(
  '/root/.codex/config.json',
  (content) => JSON.parse(content).model === 'gpt-4o'
);
```

#### Proposed matcher API

| Matcher | Input | Description |
|---------|-------|-------------|
| `toHaveExitCode(n)` | `ExecResult` | Check exit code, print stdout/stderr on failure |
| `toSucceedWith(text)` | `ExecResult` | Exit code 0 AND stdout contains text |
| `toFail()` | `ExecResult` | Exit code != 0 |
| `toFailWith(text)` | `ExecResult` | Exit code != 0 AND stderr contains text |
| `toHaveStdout(matcher)` | `ExecResult` | Check stdout with any expect matcher |
| `toHaveStderr(matcher)` | `ExecResult` | Check stderr with any expect matcher |
| `toHaveFile(path)` | `Container` | Async: file exists in container |
| `toHaveFileContaining(path, text)` | `Container` | Async: file exists and contains text |

**Key design principle:** On failure, matchers MUST print the full context
(command, stdout, stderr, exit code) so the developer never has to go
dig through logs.

**Implementation:** Vitest `expect.extend()` in a setup file or importable
module. Async matchers use `Promise` return. TypeScript augments
`vitest.Assertion` for autocomplete.

```typescript
// matchers.ts
import type { ExecResult, Container } from './types.js';

export const containerMatchers = {
  toHaveExitCode(received: ExecResult, expected: number) {
    const pass = received.exitCode === expected;
    return {
      pass,
      message: () =>
        `Expected exit code ${expected}, got ${received.exitCode}\n` +
        `  stdout: ${received.stdout.slice(0, 500)}\n` +
        `  stderr: ${received.stderr.slice(0, 500)}`,
    };
  },

  toSucceedWith(received: ExecResult, text: string) {
    const pass = received.exitCode === 0 && received.stdout.includes(text);
    return {
      pass,
      message: () =>
        pass
          ? `Expected not to succeed with "${text}"`
          : received.exitCode !== 0
            ? `Command failed with exit code ${received.exitCode}\n  stderr: ${received.stderr.slice(0, 500)}`
            : `stdout does not contain "${text}"\n  stdout: ${received.stdout.slice(0, 500)}`,
    };
  },

  async toHaveFile(received: Container, path: string) {
    const exists = await received.fileExists(path);
    return {
      pass: exists,
      message: () => `Expected container ${exists ? 'not ' : ''}to have file: ${path}`,
    };
  },
};
```

---

### Step 4: Catalog assertions per command

**Question:** What should each test step actually assert?

**Approach:** Run each command interactively with the new exec API and catalog
all observable outputs.

#### Login

| What | Where | Expected |
|------|-------|----------|
| Exit code | `exitCode` | 0 |
| Output | `stdout` | Contains login success indicator |
| Credential file | `~/.poe-code/credentials.json` | Contains apiKey field |

#### Install

| What | Where | Expected |
|------|-------|----------|
| Exit code | `exitCode` | 0 |
| Output | `stdout` | Contains agent name, "installed" indicator |
| Binary/config | varies per agent | Agent-specific binary or config dir exists |

#### Configure

| What | Where | Expected |
|------|-------|----------|
| Exit code | `exitCode` | 0 |
| Output | `stdout` | Configuration confirmation |
| Config files | agent-specific paths | Files exist, contain expected structure |

#### Test / Ping

| What | Where | Expected |
|------|-------|----------|
| Exit code | `exitCode` | 0 |
| Output | `stdout` | Success indicator (checkmark, "passed", etc.) |

**This step is empirical.** Run the commands, capture output, then codify.

---

### Step 5: Investigate filesystem API ergonomics

**Question:** How should `readFile`, `fileExists`, `writeFile` behave at the
edges?

| Operation | Edge case | Expected behavior |
|-----------|-----------|-------------------|
| `readFile` | File exists | Return contents as string |
| `readFile` | File doesn't exist | Throw with path in message |
| `readFile` | Binary file | Return raw string (document limitation) |
| `readFile` | Large file (>1MB) | Works, but warn in docs about docker exec pipe limits |
| `fileExists` | File exists | `true` |
| `fileExists` | File doesn't exist | `false` |
| `fileExists` | Directory exists | `false` (it's not a file) |
| `writeFile` | New file | Creates it |
| `writeFile` | Existing file | Overwrites |
| `writeFile` | Directory in path doesn't exist | Throw (match Node fs behavior) |

**Implementation via docker exec:**
```bash
# readFile
docker exec <id> cat /path/to/file

# fileExists
docker exec <id> test -f /path/to/file

# writeFile — stdin piping for safety
echo -n "content" | docker exec -i <id> sh -c 'cat > /path/to/file'
```

**Decision:** Use `spawnSync` with `input` option to pipe content to
`docker exec -i <id> sh -c 'cat > <path>'`. This handles arbitrary content
(multi-line, special chars) correctly.

---

### Step 6: Investigate network interception

**Question:** Can we intercept and mock HTTP traffic inside the container?

**Full investigation:** See [docs/e2e-network-interception.md](e2e-network-interception.md)
for detailed spike results, approach comparison, and assertion API design.

**Summary of spike (validated with live Docker containers):**

| Approach | Feasibility | Overhead | HTTPS | Mocking |
|----------|------------|----------|-------|---------|
| **mitmproxy sidecar** | Validated | ~0ms | Yes (CA cert + NODE_EXTRA_CA_CERTS) | Yes (Python addon) |
| **In-container proxy** | Feasible | ~0ms | Yes | Yes, but pollutes image (+100MB) |
| **Node.js mock server** | Validated | ~0ms | Partial | Yes, but needs `--api-url` flag |
| **iptables redirect** | Not spiked | ~0ms | Yes | Yes, but needs CAP_NET_ADMIN |

**Recommendation:** **Defer.** Current e2e tests validate CLI behavior (install,
configure, test), not HTTP traffic. The mitmproxy sidecar approach works and has
negligible overhead, but adds significant infrastructure complexity (Docker
network, sidecar lifecycle, CA certs, Python scripting, JSONL parsing) for a
need that doesn't exist yet. Revisit when we need to test API interactions
without real services.

---

### Step 7: Investigate container setup in beforeAll vs test steps

**Question:** Should container initialization (login, install) happen in
`beforeAll` or as regular test steps?

#### Option A: beforeAll does setup

```typescript
beforeAll(async () => {
  container = await createContainer();
  await container.login();
  await container.execOrThrow('poe-code install codex');
});

it('installed codex binary', async () => {
  await expect(container).toHaveFile('/root/.codex/bin/codex');
});
```

Pros: Tests are pure assertions.
Cons: If beforeAll fails, all tests skip with no diagnostic. Login/install
assertions are hidden.

#### Option B: Each step is a test — RECOMMENDED

```typescript
beforeAll(async () => {
  container = await createContainer();
});

it('login', async () => {
  await container.login();
});

it('install', async () => {
  const result = await container.exec('poe-code install codex');
  expect(result).toSucceedWith('codex');
});
```

Pros: Every step is visible. Failures pinpoint the exact command.
Cons: Tests depend on execution order (vitest runs them in order within a
describe, so this is fine).

**Decision:** Option B. The entire point of this redesign is granular
assertions. Hiding steps in beforeAll defeats the purpose.

---

## Target API

```typescript
import { createContainer, type Container } from '@poe-code/e2e-docker-test-runner';
import '@poe-code/e2e-docker-test-runner/matchers';

describe('codex', () => {
  let container: Container;

  beforeAll(async () => {
    container = await createContainer();
  });

  afterAll(async () => {
    await container.destroy();
  });

  it('login', async () => {
    await container.login();
    await expect(container).toHaveFile('/root/.poe-code/credentials.json');
  });

  it('install', async () => {
    const result = await container.exec('poe-code install codex');
    expect(result).toSucceedWith('codex');
  });

  it('configure', async () => {
    const result = await container.exec('poe-code configure codex --yes');
    expect(result).toHaveExitCode(0);
    await expect(container).toHaveFile('/root/.codex/config.json');
  });

  it('test', async () => {
    const result = await container.exec('poe-code test codex');
    expect(result).toSucceedWith('passed');
  });
});
```

### What failure messages look like

```
FAIL  e2e/codex.test.ts > codex > install
AssertionError: Expected exit code 0, got 1
  stdout: npm warn deprecated ...
  stderr: Error: codex binary not found in PATH
  ❯ expect(result).toHaveExitCode(0)

FAIL  e2e/codex.test.ts > codex > configure
AssertionError: Expected container to have file: /root/.codex/config.json
  ❯ await expect(container).toHaveFile('/root/.codex/config.json')
```

The matchers always surface the full context so you never have to grep logs.
```

---

## Story Dependency Graph

```
US-001  Investigate: docker exec approach
  |
  v
US-002  createContainer + destroy
  |
  +------------------+
  v                  v
US-003  exec       US-009  backward compat (runInContainer)
  |
  +--------+---------+---------+
  v        v         v         v
US-004   US-005    US-006    US-010  custom vitest matchers
 fs ops   login    assert      |
  |        |       catalog     |
  |        |         |         |
  |        +----+----+---------+
  |             v
  |           US-007  Refactor all e2e tests
  |             |
  |             +------------+
  |             v            v
  |           US-008       US-011  developer documentation
  |           network
  v           interception
 (done)
```
