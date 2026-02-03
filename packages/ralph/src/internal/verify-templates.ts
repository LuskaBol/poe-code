import path from "node:path";
import { fileURLToPath } from "node:url";
import { stat } from "node:fs/promises";
import { isNotFound } from "@poe-code/config-mutations";

export type TemplateVerifierFileSystem = {
  stat: (filePath: string) => Promise<{ isFile(): boolean }>;
};

const requiredTemplatePaths = [
  "templates/PROMPT_build.md",
  "templates/references/GUARDRAILS.md",
  "templates/references/CONTEXT_ENGINEERING.md",
  "templates/.ralph/progress.md",
  "templates/.ralph/guardrails.md",
  "templates/.ralph/errors.log",
  "templates/.ralph/activity.log"
];


export async function verifyBundledTemplates(args: {
  fs: TemplateVerifierFileSystem;
  packageRoot: string;
}): Promise<void> {
  const missing: string[] = [];

  for (const relativePath of requiredTemplatePaths) {
    const absPath = path.join(args.packageRoot, relativePath);
    try {
      const stats = await args.fs.stat(absPath);
      if (!stats.isFile()) {
        missing.push(relativePath);
      }
    } catch (error) {
      if (isNotFound(error)) {
        missing.push(relativePath);
        continue;
      }
      throw error;
    }
  }

  if (missing.length === 0) {
    return;
  }

  missing.sort((a, b) => a.localeCompare(b));
  throw new Error(
    ["Missing @poe-code/ralph bundled templates:", ...missing.map(p => `- ${p}`)]
      .join("\n")
      .trim()
  );
}

const isMain = (() => {
  const invoked = process.argv[1];
  if (typeof invoked !== "string" || invoked.length === 0) {
    return false;
  }
  return path.resolve(invoked) === fileURLToPath(import.meta.url);
})();

if (isMain) {
  await verifyBundledTemplates({
    fs: { stat },
    packageRoot: process.cwd()
  }).catch(error => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  });
}
