import { ValidationError } from "./errors.js";

export type McpOutputFormat = "url" | "base64" | "markdown";

export function parseMcpOutputFormatPreferences(
  value: string | undefined
): McpOutputFormat[] {
  if (value === undefined) {
    return ["url"];
  }

  const rawParts = value.split(",");
  const preferences: McpOutputFormat[] = [];

  for (const raw of rawParts) {
    const normalized = raw.trim().toLowerCase();
    if (normalized.length === 0) {
      throw new ValidationError(
        `Invalid --output-format: empty entry in "${value}". ` +
          `Use "url", "base64", "markdown", or a comma-separated list like "base64,url".`
      );
    }

    if (
      normalized !== "url" &&
      normalized !== "base64" &&
      normalized !== "markdown"
    ) {
      throw new ValidationError(
        `Invalid --output-format entry "${raw.trim()}". ` +
          `Expected "url", "base64", or "markdown".`
      );
    }

    preferences.push(normalized as McpOutputFormat);
  }

  if (preferences.includes("markdown") && preferences.length > 1) {
    throw new ValidationError(
      "markdown output format cannot be combined with other formats. Use markdown alone or choose a different format combination."
    );
  }

  return preferences;
}
