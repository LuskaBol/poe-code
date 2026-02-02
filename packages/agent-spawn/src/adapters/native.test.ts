import { describe, it, expect, vi } from "vitest";
import { adaptNative } from "./native.js";

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

describe("adaptNative", () => {
  it("passes through ACP-compatible events unchanged", async () => {
    const input = { event: "tool_start", id: "x", kind: "read", title: "read file" };
    const updates = await collect(adaptNative(fromArray([JSON.stringify(input)])));
    expect(updates).toEqual([input]);
  });

  it("skips events missing an event field with a warning", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const updates = await collect(adaptNative(fromArray(['{"type":"something"}'])));

    expect(updates).toEqual([]);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it("skips events with a non-string event field with a warning", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const updates = await collect(adaptNative(fromArray(['{"event":123}'])));

    expect(updates).toEqual([]);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it("skips malformed JSON lines and continues", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const input = { event: "tool_start", id: "x" };
    const updates = await collect(adaptNative(fromArray(["not json", JSON.stringify(input)])));

    expect(updates).toEqual([input]);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});

