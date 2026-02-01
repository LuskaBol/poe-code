import { ValidationError } from "./errors.js";

export type McpOutputFormat = "url" | "base64";

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
          `Use "url", "base64", or a comma-separated list like "base64,url".`
      );
    }

    if (normalized !== "url" && normalized !== "base64") {
      throw new ValidationError(
        `Invalid --output-format entry "${raw.trim()}". ` +
          `Expected "url" or "base64".`
      );
    }

    preferences.push(normalized as McpOutputFormat);
  }

  return preferences;
}

