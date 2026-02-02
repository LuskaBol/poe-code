import path from "node:path";
import { cp, rm, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(currentDir, "..");
const templateSource = path.join(packageRoot, "src", "templates");
const templateDestination = path.join(packageRoot, "dist", "templates");

await stat(templateSource);
await rm(templateDestination, { recursive: true, force: true }).catch(() => {});

await cp(templateSource, templateDestination, {
  recursive: true,
  filter: (sourcePath) => {
    if (sourcePath.endsWith(".ts")) {
      return false;
    }
    return true;
  }
});

