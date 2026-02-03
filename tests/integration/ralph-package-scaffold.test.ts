import fs from "node:fs";
import path from "node:path";
import { Volume, createFsFromVolume } from "memfs";
import * as ts from "typescript";

function readJsonFile<T>(filePath: string): T {
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw) as T;
}

function compileWithVirtualNodeModules(args: {
  entryPath: string;
  entrySource: string;
  packageJson: unknown;
}): ts.Diagnostic[] {
  const workspaceRoot = "/project";
  const entryFullPath = path.posix.join(workspaceRoot, args.entryPath);
  const packageRoot = path.posix.join(
    workspaceRoot,
    "node_modules/@poe-code/ralph"
  );

  const vol = Volume.fromJSON(
    {
      [entryFullPath]: args.entrySource,
      [path.posix.join(packageRoot, "package.json")]: JSON.stringify(
        args.packageJson,
        null,
        2
      ),
      [path.posix.join(packageRoot, "dist/index.d.ts")]: "export {};",
      [path.posix.join(packageRoot, "dist/index.js")]: "export {};",
      [path.posix.join(packageRoot, "dist/internal/secret.d.ts")]:
        "export declare const secret: string;"
    },
    workspaceRoot
  );

  const memfs = createFsFromVolume(vol);

  const compilerOptions: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    strict: true,
    skipLibCheck: true,
    noEmit: true,
    types: []
  };

  const host = ts.createCompilerHost(compilerOptions, true);

  host.getCurrentDirectory = () => workspaceRoot;
  host.fileExists = filePath =>
    memfs.existsSync(filePath) || ts.sys.fileExists(filePath);
  host.readFile = filePath =>
    memfs.existsSync(filePath)
      ? (memfs.readFileSync(filePath, "utf8") as string)
      : ts.sys.readFile(filePath);
  host.directoryExists = dirPath => {
    try {
      return memfs.statSync(dirPath).isDirectory();
    } catch {
      return ts.sys.directoryExists(dirPath);
    }
  };
  host.getDirectories = dirPath => {
    try {
      return memfs
        .readdirSync(dirPath, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name);
    } catch {
      return ts.sys.getDirectories(dirPath);
    }
  };
  host.realpath = p => p;
  host.writeFile = () => {};

  const program = ts.createProgram([entryFullPath], compilerOptions, host);
  return ts.getPreEmitDiagnostics(program);
}

describe("US-001 ralph package scaffold", () => {
  const repoRoot = path.resolve(__dirname, "../..");
  const ralphDir = path.join(repoRoot, "packages/ralph");
  const ralphPackageJsonPath = path.join(ralphDir, "package.json");
  const ralphTsconfigPath = path.join(ralphDir, "tsconfig.json");
  const ralphIndexPath = path.join(ralphDir, "src/index.ts");

  it("creates packages/ralph package config + entrypoint", () => {
    expect(fs.existsSync(ralphDir)).toBe(true);
    expect(fs.existsSync(ralphPackageJsonPath)).toBe(true);
    expect(fs.existsSync(ralphTsconfigPath)).toBe(true);
    expect(fs.existsSync(ralphIndexPath)).toBe(true);

    const pkg = readJsonFile<{
      name: string;
      exports?: unknown;
      main?: string;
      types?: string;
    }>(ralphPackageJsonPath);

    expect(pkg.name).toBe("@poe-code/ralph");
    expect(pkg.main).toBe("dist/index.js");
    expect(pkg.types).toBe("dist/index.d.ts");

    const exportsValue = pkg.exports as Record<string, unknown> | undefined;
    expect(exportsValue).toBeDefined();
    expect(Object.keys(exportsValue ?? {})).toEqual([".", "./testing"]);
  });

  it("prevents TypeScript from importing non-exported internals", () => {
    const pkg = readJsonFile<Record<string, unknown>>(ralphPackageJsonPath);

    const diagnostics = compileWithVirtualNodeModules({
      entryPath: "src/entry.ts",
      entrySource:
        "import { secret } from '@poe-code/ralph/internal/secret'; void secret;",
      packageJson: pkg
    });

    const moduleNotFound = diagnostics.find(d => d.code === 2307);
    expect(moduleNotFound).toBeDefined();
  });

  it("allows TypeScript to import the public entrypoint", () => {
    const pkg = readJsonFile<Record<string, unknown>>(ralphPackageJsonPath);

    const diagnostics = compileWithVirtualNodeModules({
      entryPath: "src/entry.ts",
      entrySource: "import '@poe-code/ralph';",
      packageJson: pkg
    });

    expect(diagnostics).toEqual([]);
  });
});
