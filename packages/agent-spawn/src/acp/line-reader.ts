import type { Readable } from "node:stream";

function chunkToString(chunk: unknown): string {
  if (typeof chunk === "string") return chunk;
  if (chunk instanceof Uint8Array) return Buffer.from(chunk).toString("utf8");
  return String(chunk);
}

export async function* readLines(stream: Readable): AsyncGenerator<string> {
  let buffer = "";

  for await (const chunk of stream as AsyncIterable<unknown>) {
    buffer += chunkToString(chunk);

    while (true) {
      const newlineIndex = buffer.indexOf("\n");
      if (newlineIndex === -1) break;

      yield buffer.slice(0, newlineIndex);
      buffer = buffer.slice(newlineIndex + 1);
    }
  }

  if (buffer.length > 0) {
    yield buffer;
  }
}
