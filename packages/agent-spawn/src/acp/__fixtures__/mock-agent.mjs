import fs from "node:fs/promises";

const fixturesUrl = new URL("./sample-sessions.json", import.meta.url);
const fixtures = JSON.parse(await fs.readFile(fixturesUrl, "utf8"));

const mode = process.argv[2] ?? "codex";

if (mode === "fail") {
  process.stderr.write("mock agent failed\n");
  process.exit(2);
}

const lines =
  mode === "codex"
    ? fixtures.codexSession
    : mode === "claude"
      ? fixtures.claudeSession
      : undefined;

if (!Array.isArray(lines) || !lines.every((line) => typeof line === "string")) {
  process.stderr.write(`unknown or invalid fixture: ${mode}\n`);
  process.exit(1);
}

for (const line of lines) {
  process.stdout.write(`${line}\n`);
}
