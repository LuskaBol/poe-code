import * as esbuild from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(currentDir, "..");

// Read external deps from root package.json - these are runtime deps users install
const packageJson = JSON.parse(await readFile(path.join(rootDir, "package.json"), "utf8"));
const allDeps = Object.keys(packageJson.dependencies || {});

// Filter out workspace packages - they should be bundled, not external
const runtimeDeps = allDeps.filter((dep) => !dep.startsWith("@poe-code/"));

// External dependencies: runtime deps from package.json + Node built-ins
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
  banner: {
    js: "#!/usr/bin/env node",
  },
  sourcemap: true,
  packages: "bundle",
  plugins: [stripShebangPlugin],
});

console.log("Bundle complete: dist/index.js");
