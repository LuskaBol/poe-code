import type { AcpEvent } from "../acp/types.js";
import { truncate, isNonEmptyString, extractThreadId } from "./utils.js";

type KimiEvent = {
  role?: unknown;
  content?: unknown;
  thread_id?: unknown;
  threadId?: unknown;
  threadID?: unknown;
  session_id?: unknown;
  sessionId?: unknown;
  sessionID?: unknown;
};

export async function* adaptKimi(
  lines: AsyncIterable<string>
): AsyncGenerator<AcpEvent> {
  let emittedSessionStart = false;

  for await (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    let event: KimiEvent;
    try {
      event = JSON.parse(line) as KimiEvent;
    } catch (error) {
      const stack = error instanceof Error ? error.stack : undefined;
      yield {
        event: "error",
        message: `[adaptKimi] Malformed JSON line: ${truncate(line, 200)}`,
        stack
      };
      continue;
    }

    if (!event || typeof event !== "object") continue;

    if (!emittedSessionStart) {
      const threadId = extractThreadId(event);
      if (threadId) {
        emittedSessionStart = true;
        yield { event: "session_start", threadId };
      }
    }

    const role = event.role;
    if (!isNonEmptyString(role) || role !== "assistant") continue;

    const content = event.content;
    if (!isNonEmptyString(content)) continue;

    yield { event: "agent_message", text: content };
  }
}
