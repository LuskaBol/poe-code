import * as esbuild from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(currentDir, "..");

// External dependencies that should NOT be bundled (they're on npm)
const externalDeps = [
  // Main package deps
  "chalk",
  "commander",
  "diff",
  "mustache",
  "semver",
  // Workspace package deps (transitive)
  "jsonc-parser",
  "smol-toml",
  // Node built-ins
  "node:*",
];

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
