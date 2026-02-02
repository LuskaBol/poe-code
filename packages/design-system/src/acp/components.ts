import chalk from "chalk";

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  if (maxLength <= 3) return text.slice(0, maxLength);
  return `${text.slice(0, maxLength - 3)}...`;
}

const KIND_COLORS: Record<string, (text: string) => string> = {
  exec: (text) => chalk.yellow(text),
  edit: (text) => chalk.magenta(text),
  read: (text) => chalk.cyan(text),
  search: (text) => chalk.blue(text),
  think: (text) => chalk.dim(text),
  other: (text) => chalk.dim(text)
};

function colorForKind(kind: string): (text: string) => string {
  return KIND_COLORS[kind] ?? ((text) => chalk.dim(text));
}

function writeLine(line: string): void {
  process.stdout.write(`${line}\n`);
}

const AGENT_PREFIX = `${chalk.green.bold("✓")} agent: `;

export interface StreamingOptions {
  characterDelay?: number;
}

export function renderAgentMessage(text: string): void;
export function renderAgentMessage(
  text: string,
  options: { streaming: true | StreamingOptions }
): Promise<void>;
export function renderAgentMessage(
  text: string,
  options?: { streaming?: boolean | StreamingOptions }
): void | Promise<void> {
  if (options?.streaming) {
    const streamingOptions = typeof options.streaming === "object"
      ? options.streaming
      : undefined;
    return renderAgentMessageStreaming(text, streamingOptions);
  }

  writeLine(`${AGENT_PREFIX}${text}`);
}

export async function renderAgentMessageStreaming(
  text: string,
  options?: StreamingOptions
): Promise<void> {
  const characterDelay = options?.characterDelay ?? 10;

  process.stdout.write(AGENT_PREFIX);

  for (const char of text) {
    process.stdout.write(char);
    if (characterDelay > 0) {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, characterDelay);
      });
    }
  }

  process.stdout.write("\n");
}

export function renderToolStart(kind: string, title: string): void {
  const color = colorForKind(kind);
  writeLine(color(`  → ${kind}: ${title}`));
}

export function renderToolComplete(kind: string, title?: string): void {
  const color = colorForKind(kind);
  const suffix = title ? `: ${title}` : "";
  writeLine(color(`  ✓ ${kind}${suffix}`));
}

export function renderReasoning(text: string): void {
  writeLine(chalk.dim(`  ✓ ${truncate(text, 80)}`));
}

export function renderUsage(tokens: {
  input: number;
  output: number;
  cached?: number;
  costUsd?: number;
}): void {
  const cached = typeof tokens.cached === "number" && tokens.cached > 0
    ? ` (${tokens.cached} cached)`
    : "";

  let cost = "";
  if (typeof tokens.costUsd === "number") {
    const formatted = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 6
    }).format(tokens.costUsd);
    cost = ` (${formatted})`;
  }

  writeLine(
    chalk.green(
      `✓ tokens: ${tokens.input} in${cached} → ${tokens.output} out${cost}`
    )
  );
}

export function renderError(message: string): void {
  writeLine(chalk.red(`✗ ${message}`));
}
