import Mustache from "mustache";

type TemplateLoader = (relativePath: string) => Promise<string>;

let customLoader: TemplateLoader | null = null;
let templatesCache: Record<string, string> | null = null;

async function getTemplates(): Promise<Record<string, string>> {
  if (templatesCache) {
    return templatesCache;
  }
  // Lazy import templates as text (bundled by esbuild)
  const [pythonEnvTemplate, pythonMainTemplate, pythonRequirementsTemplate, codexConfigTemplate] =
    await Promise.all([
      import("../templates/python/env.hbs").then((m) => m.default),
      import("../templates/python/main.py.hbs").then((m) => m.default),
      import("../templates/python/requirements.txt.hbs").then((m) => m.default),
      import("../templates/codex/config.toml.hbs").then((m) => m.default),
    ]);
  templatesCache = {
    "python/env.hbs": pythonEnvTemplate,
    "python/main.py.hbs": pythonMainTemplate,
    "python/requirements.txt.hbs": pythonRequirementsTemplate,
    "codex/config.toml.hbs": codexConfigTemplate,
  };
  return templatesCache;
}

export async function renderTemplate(
  relativePath: string,
  context: Record<string, unknown>
): Promise<string> {
  const source = await loadTemplate(relativePath);
  return Mustache.render(source, context);
}

export function setTemplateLoader(loader: TemplateLoader | null): void {
  customLoader = loader;
}

export async function loadTemplate(relativePath: string): Promise<string> {
  if (customLoader) {
    return customLoader(relativePath);
  }
  const templates = await getTemplates();
  const template = templates[relativePath];
  if (!template) {
    throw new Error(`Template not found: ${relativePath}`);
  }
  return template;
}
