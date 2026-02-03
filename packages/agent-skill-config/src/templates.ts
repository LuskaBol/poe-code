import type { TemplateLoader } from "@poe-code/config-mutations";
import { readFile } from "node:fs/promises";

let templatesCache: Record<string, string> | null = null;

async function getTemplates(): Promise<Record<string, string>> {
  if (templatesCache) {
    return templatesCache;
  }
  const poeGenerateTemplateUrl = new URL(
    "./templates/poe-generate.md",
    import.meta.url
  );
  const poeGenerateTemplate = await readFile(poeGenerateTemplateUrl, "utf8");
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
