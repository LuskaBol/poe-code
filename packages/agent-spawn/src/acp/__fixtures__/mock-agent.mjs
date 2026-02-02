import fs from "node:fs/promises";

const prdUrl = new URL("../../../../../.agents/tasks/prd-acp-spawn-adapters.json", import.meta.url);
const prd = JSON.parse(await fs.readFile(prdUrl, "utf8"));

const mode = process.argv[2] ?? "codex";

if (mode === "fail") {
  process.stderr.write("mock agent failed\n");
  process.exit(2);
}

const sampleFixtures = prd.sampleFixtures ?? {};

const lines =
  mode === "codex"
    ? sampleFixtures.codexSession
    : mode === "claude"
      ? sampleFixtures.claudeSession
      : undefined;

if (!Array.isArray(lines) || !lines.every((line) => typeof line === "string")) {
  process.stderr.write(`unknown or invalid fixture: ${mode}\n`);
  process.exit(1);
}

for (const line of lines) {
  process.stdout.write(`${line}\n`);
}
