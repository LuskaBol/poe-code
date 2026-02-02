import { describe, it, expect, vi } from "vitest";
import fs from "node:fs/promises";
import { adaptClaude } from "./claude.js";

async function* fromArray(items: string[]): AsyncIterable<string> {
  for (const item of items) {
    yield item;
  }
}

async function collect<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const items: T[] = [];
  for await (const item of iterable) {
    items.push(item);
  }
  return items;
}

async function loadClaudeSessionFixture(): Promise<string[]> {
  const fixturesUrl = new URL("../acp/__fixtures__/sample-sessions.json", import.meta.url);
  const fixtures = JSON.parse(await fs.readFile(fixturesUrl, "utf8")) as {
    claudeSession?: unknown;
  };
  const session = fixtures.claudeSession;
  if (!Array.isArray(session) || !session.every((line) => typeof line === "string")) {
    throw new Error("Fixture claudeSession is missing or invalid");
  }
  return session;
}

describe("adaptClaude", () => {
  it("adapts sampleFixtures.claudeSession from the PRD", async () => {
    const session = await loadClaudeSessionFixture();
    const events = await collect(adaptClaude(fromArray(session)));

    expect(events).toEqual([
      {
        event: "agent_message",
        text: "I'll check the current directory structure."
      },
      {
        event: "tool_start",
        id: "tu_1",
        kind: "exec",
        title: "Bash",
        input: { command: "ls -la" }
      },
      {
        event: "tool_complete",
        id: "tu_1",
        kind: "exec",
        path: "total 24\ndrwxr-xr-x  5 user  staff   160 Jan 15 10:00 .\n..."
      },
      {
        event: "tool_start",
        id: "tu_2",
        kind: "edit",
        title: "Edit",
        input: {
          file_path: "src/config.ts",
          old_string: "port: 3000",
          new_string: "port: 8080"
        }
      },
      {
        event: "tool_complete",
        id: "tu_2",
        kind: "edit",
        path: "File edited successfully"
      },
      {
        event: "agent_message",
        text: "I've updated the port configuration from 3000 to 8080."
      },
      { event: "usage", inputTokens: 2000, outputTokens: 500, costUsd: 0.015 }
    ]);
  });

  it("emits agent_message for assistant text blocks", async () => {
    const updates = await collect(
      adaptClaude(
        fromArray([
          JSON.stringify({
            type: "assistant",
            message: { content: [{ type: "text", text: "hello" }, { type: "text", text: "world" }] }
          })
        ])
      )
    );

    expect(updates).toEqual([
      { event: "agent_message", text: "hello" },
      { event: "agent_message", text: "world" }
    ]);
  });

  it.each([
    ["Read", "read"],
    ["Write", "edit"],
    ["Edit", "edit"],
    ["Bash", "exec"],
    ["Glob", "search"],
    ["Grep", "search"],
    ["Task", "think"]
  ] as const)("maps tool_use %s to kind: %s", async (name, kind) => {
    const events = await collect(
      adaptClaude(
        fromArray([
          JSON.stringify({
            type: "assistant",
            message: { content: [{ type: "tool_use", id: "tu_1", name, input: { a: 1 } }] }
          })
        ])
      )
    );

    expect(events).toEqual([
      {
        event: "tool_start",
        id: "tu_1",
        kind,
        title: name,
        input: { a: 1 }
      }
    ]);
  });

  it("maps unknown tool name to kind: other", async () => {
    const updates = await collect(
      adaptClaude(
        fromArray([
          JSON.stringify({
            type: "assistant",
            message: { content: [{ type: "tool_use", id: "tu_x", name: "Unknown", input: { a: 1 } }] }
          })
        ])
      )
    );

    expect(updates).toEqual([
      {
        event: "tool_start",
        id: "tu_x",
        kind: "other",
        title: "Unknown",
        input: { a: 1 }
      }
    ]);
  });

  it("tracks tool kind from tool_start to tool_complete", async () => {
    const events = await collect(
      adaptClaude(
        fromArray([
          '{"type":"assistant","message":{"content":[{"type":"tool_use","id":"tu_1","name":"Bash","input":{"command":"ls"}}]}}',
          '{"type":"user","message":{"content":[{"type":"tool_result","tool_use_id":"tu_1","content":"ok"}]}}'
        ])
      )
    );

    expect(events).toEqual([
      {
        event: "tool_start",
        id: "tu_1",
        kind: "exec",
        title: "Bash",
        input: { command: "ls" }
      },
      {
        event: "tool_complete",
        id: "tu_1",
        kind: "exec",
        path: "ok"
      }
    ]);
  });

  it("emits tool_complete with kind: undefined for unknown tool_use_id (no crash)", async () => {
    const updates = await collect(
      adaptClaude(
        fromArray([
          '{"type":"user","message":{"content":[{"type":"tool_result","tool_use_id":"tu_unknown","content":{"ok":true}}]}}'
        ])
      )
    );

    expect(updates).toEqual([
      {
        kind: undefined,
        event: "tool_complete",
        id: "tu_unknown",
        path: "{\"ok\":true}"
      }
    ]);
  });

  it("emits usage for result with costUsd", async () => {
    const updates = await collect(
      adaptClaude(
        fromArray([
          JSON.stringify({ type: "result", input_tokens: 1, output_tokens: 2, cost_usd: 0.03 })
        ])
      )
    );

    expect(updates).toEqual([
      {
        event: "usage",
        inputTokens: 1,
        outputTokens: 2,
        costUsd: 0.03
      }
    ]);
  });

  it("skips malformed JSON lines and continues", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const updates = await collect(
      adaptClaude(
        fromArray([
          "not json",
          '{"type":"assistant","message":{"content":[{"type":"text","text":"ok"}]}}'
        ])
      )
    );

    expect(updates).toEqual([{ event: "agent_message", text: "ok" }]);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});
