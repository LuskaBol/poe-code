import * as esbuild from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFile, readdir } from "node:fs/promises";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(currentDir, "..");

// Read workspace package names and create source aliases
const packagesDir = path.join(rootDir, "packages");
const workspaceDirs = await readdir(packagesDir, { withFileTypes: true });
const workspaceAliases = {};
const workspacePackageNames = new Set();

for (const dir of workspaceDirs.filter((d) => d.isDirectory())) {
  const pkgPath = path.join(packagesDir, dir.name, "package.json");
  const pkg = JSON.parse(await readFile(pkgPath, "utf8"));
  workspacePackageNames.add(pkg.name);
  // Resolve workspace packages to source (Just-in-Time compilation)
  workspaceAliases[pkg.name] = path.join(packagesDir, dir.name, "src/index.ts");
}

// External deps = root package.json dependencies (what users install via npm)
const packageJson = JSON.parse(
  await readFile(path.join(rootDir, "package.json"), "utf8")
);
const runtimeDeps = Object.keys(packageJson.dependencies || {}).filter(
  (dep) => !workspacePackageNames.has(dep)
);
const externalDeps = [...runtimeDeps, "node:*"];

// Plugin to strip shebangs from source files
const stripShebangPlugin = {
  name: "strip-shebang",
  setup(build) {
    build.onLoad({ filter: /\.ts$/ }, async (args) => {
      let contents = await readFile(args.path, "utf8");
      if (contents.startsWith("#!")) {
        contents = contents.replace(/^#!.*\n/, "");
      }
      return { contents, loader: "ts" };
    });
  },
};

await esbuild.build({
  entryPoints: [path.join(rootDir, "src/index.ts")],
  bundle: true,
  platform: "node",
  target: "node18",
  format: "esm",
  outfile: path.join(rootDir, "dist/index.js"),
  external: externalDeps,
  alias: workspaceAliases,
  banner: {
    js: "#!/usr/bin/env node",
  },
  sourcemap: true,
  plugins: [stripShebangPlugin],
  loader: { ".md": "text", ".hbs": "text" },
});

console.log("Bundle complete: dist/index.js");
