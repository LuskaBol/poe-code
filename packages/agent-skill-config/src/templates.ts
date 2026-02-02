import path from "node:path";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { TemplateLoader } from "@poe-code/config-mutations";

const templatesRoot = fileURLToPath(new URL("./templates", import.meta.url));

function resolveTemplatePath(templateId: string): string {
  const resolved = path.resolve(templatesRoot, templateId);
  const relative = path.relative(templatesRoot, resolved);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Invalid template id: ${templateId}`);
  }

  return resolved;
}

export async function loadTemplate(templateId: string): Promise<string> {
  const templatePath = resolveTemplatePath(templateId);
  return readFile(templatePath, "utf8");
}

export function createTemplateLoader(): TemplateLoader {
  return loadTemplate;
}

