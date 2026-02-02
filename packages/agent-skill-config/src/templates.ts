import type { TemplateLoader } from "@poe-code/config-mutations";

let templatesCache: Record<string, string> | null = null;

async function getTemplates(): Promise<Record<string, string>> {
  if (templatesCache) {
    return templatesCache;
  }
  // Lazy import templates as text (bundled by esbuild)
  const poeGenerateTemplate = await import("./templates/poe-generate.md").then(
    (m) => m.default
  );
  templatesCache = {
    "poe-generate.md": poeGenerateTemplate,
  };
  return templatesCache;
}

export async function loadTemplate(templateId: string): Promise<string> {
  const templates = await getTemplates();
  const template = templates[templateId];
  if (!template) {
    throw new Error(`Template not found: ${templateId}`);
  }
  return template;
}

export function createTemplateLoader(): TemplateLoader {
  return loadTemplate;
}
