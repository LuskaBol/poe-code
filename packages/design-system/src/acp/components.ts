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

export function renderAgentMessage(text: string): void {
  writeLine(`${AGENT_PREFIX}${text}`);
}

export function renderToolStart(kind: string, title: string): void {
  const color = colorForKind(kind);
  writeLine(color(`  → ${kind}: ${title}`));
}

export function renderToolComplete(kind: string): void {
  const color = colorForKind(kind);
  writeLine(color(`  ✓ ${kind}`));
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
