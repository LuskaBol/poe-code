import Mustache from "mustache";

export type TemplateVariables = Record<string, string | number | boolean | string[]>;

// Disable HTML escaping - we're rendering prompts, not HTML
const originalEscape = Mustache.escape;

/**
 * Render a mustache template with the given variables.
 * Arrays are automatically joined with newlines.
 * HTML escaping is disabled.
 */
export function renderTemplate(
  template: string,
  variables: TemplateVariables
): string {
  // Pre-process variables to handle arrays
  const processed: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(variables)) {
    if (Array.isArray(value)) {
      processed[key] = value.join("\n");
    } else {
      processed[key] = value;
    }
  }

  // Temporarily disable HTML escaping
  Mustache.escape = (text: string) => text;
  try {
    return Mustache.render(template, processed);
  } finally {
    Mustache.escape = originalEscape;
  }
}
