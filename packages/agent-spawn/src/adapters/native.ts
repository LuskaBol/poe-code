type AcpEvent = { event: string } & Record<string, unknown>;

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  if (maxLength <= 3) return text.slice(0, maxLength);
  return `${text.slice(0, maxLength - 3)}...`;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

export async function* adaptNative(
  lines: AsyncIterable<string>
): AsyncGenerator<AcpEvent> {
  for await (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    let event: unknown;
    try {
      event = JSON.parse(line) as unknown;
    } catch (error) {
      console.warn(`[adaptNative] Skipping malformed JSON line: ${truncate(line, 200)}`, error);
      continue;
    }

    const maybeEventType = (event as { event?: unknown } | null)?.event;
    if (!isNonEmptyString(maybeEventType)) {
      console.warn(
        `[adaptNative] Skipping line missing string 'event' field: ${truncate(line, 200)}`
      );
      continue;
    }

    yield event as AcpEvent;
  }
}

