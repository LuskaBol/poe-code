export type OutputFormat = "terminal" | "markdown" | "json";

const VALID_FORMATS = new Set<OutputFormat>(["terminal", "markdown", "json"]);

let cached: OutputFormat | undefined;

export function resolveOutputFormat(
  env: { OUTPUT_FORMAT?: string } = process.env as { OUTPUT_FORMAT?: string }
): OutputFormat {
  if (cached) {
    return cached;
  }
  const raw = env.OUTPUT_FORMAT?.toLowerCase();
  cached = VALID_FORMATS.has(raw as OutputFormat) ? (raw as OutputFormat) : "terminal";
  return cached;
}

export function resetOutputFormatCache(): void {
  cached = undefined;
}
