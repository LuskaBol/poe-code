import type { Command } from "commander";
import { select, isCancel, cancel } from "@poe-code/design-system";
import type { CliContainer } from "../container.js";
import { loadCredentials } from "../../services/credentials.js";
import { initializeClient } from "../../services/client-instance.js";
import { runMcpServerWithTransport, formatMcpToolsDocs } from "../mcp-server.js";
import { createExecutionResources, resolveCommandFlags } from "./shared.js";
import { ValidationError } from "../errors.js";
import {
  supportedAgents,
  configure,
  unconfigure,
  resolveAgentSupport,
  type McpServerEntry
} from "@poe-code/agent-mcp-config";
import {
  getCurrentExecutionContext,
  toMcpServerCommand
} from "../../utils/execution-context.js";
import {
  DEFAULT_AGENT,
  MCP_AGENT_PROFILES,
  formatAgentsList,
  getAgentProfile,
  type McpAgentProfile
} from "../mcp-agents.js";

const DEFAULT_MCP_AGENT = "claude-code";

function createMcpServerEntry(
  profileName = DEFAULT_AGENT
): McpServerEntry {
  const context = getCurrentExecutionContext(import.meta.url);
  const mcpCommand = toMcpServerCommand(context.command, "mcp");
  return {
    name: "poe-code",
    config: {
      transport: "stdio",
      command: mcpCommand.command,
      args: [...mcpCommand.args, "serve", "--agent", profileName]
    }
  };
}

function buildHelpText(): string {
  const server = createMcpServerEntry(DEFAULT_AGENT);
  const lines: string[] = [
    "",
    "Configuration:",
    JSON.stringify({ [server.name]: server.config }, null, 2),
    "",
    formatMcpToolsDocs(),
    "",
    formatAgentsList()
  ];
  return lines.join("\n");
}

export function registerMcpCommand(
  program: Command,
  container: CliContainer
): void {
  const mcp = program
    .command("mcp")
    .description("MCP server commands")
    .addHelpText("after", buildHelpText())
    .action(async function (this: Command) {
      this.help();
    });

  mcp
    .command("serve")
    .description("Run MCP server on stdin/stdout")
    .option("--agent <name>", `MCP client profile (default: ${DEFAULT_AGENT})`)
    .addHelpText("after", buildHelpText())
    .action(async function (this: Command) {
      const agent = this.opts<{ agent?: string }>().agent ?? DEFAULT_AGENT;
      const profile = getAgentProfile(agent);
      if (!profile) {
        throw new ValidationError(
          `Unknown agent: ${agent}. Available agents: ${Object.keys(MCP_AGENT_PROFILES).join(", ")}`
        );
      }
      await runMcpServer(container, profile);
    });

  mcp
    .command("configure [agent]")
    .description("Configure MCP client to use poe-code")
    .option("-y, --yes", "Skip prompt, use claude-code")
    .action(async (agentArg, options) => {
      const flags = resolveCommandFlags(program);
      const resources = createExecutionResources(container, flags, "mcp");

      let agent = agentArg;
      if (!agent) {
        if (options.yes) {
          agent = DEFAULT_MCP_AGENT;
        } else {
          const selected = await select({
            message: "Select agent to configure:",
            options: supportedAgents.map((a) => ({ value: a, label: a }))
          });
          if (isCancel(selected)) {
            cancel("Operation cancelled");
            return;
          }
          agent = selected as string;
        }
      }

      resources.logger.intro(`mcp configure ${agent}`);

      const support = resolveAgentSupport(agent);
      if (support.status === "unknown") {
        resources.logger.error(`Unknown agent: ${agent}`);
        return;
      }
      if (support.status === "unsupported") {
        resources.logger.error(`MCP not supported for ${support.id}.`);
        return;
      }

      const resolvedAgent = support.id ?? agent;
      await configure(resolvedAgent, createMcpServerEntry(resolvedAgent), {
        fs: container.fs,
        homeDir: container.env.homeDir,
        platform: process.platform as "darwin" | "linux" | "win32",
        dryRun: flags.dryRun,
        observers: {
          onStart: (details) => {
            if (flags.dryRun) {
              resources.logger.dryRun(`Would ${details.label.toLowerCase()}`);
            }
          },
          onComplete: (details, outcome) => {
            if (!flags.dryRun && outcome.changed) {
              resources.logger.verbose(details.label);
            }
          }
        }
      });

      resources.context.complete({
        success: `Configured MCP for ${resolvedAgent}.`,
        dry: `Would configure MCP for ${resolvedAgent}.`
      });
      resources.context.finalize();
    });

  mcp
    .command("unconfigure <agent>")
    .description("Remove poe-code from MCP client")
    .action(async (agent) => {
      const flags = resolveCommandFlags(program);
      const resources = createExecutionResources(container, flags, "mcp");

      resources.logger.intro(`mcp unconfigure ${agent}`);

      const support = resolveAgentSupport(agent);
      if (support.status === "unknown") {
        resources.logger.error(`Unknown agent: ${agent}`);
        return;
      }
      if (support.status === "unsupported") {
        resources.logger.error(`MCP not supported for ${support.id}.`);
        return;
      }

      const resolvedAgent = support.id ?? agent;
      await unconfigure(resolvedAgent, "poe-code", {
        fs: container.fs,
        homeDir: container.env.homeDir,
        platform: process.platform as "darwin" | "linux" | "win32",
        dryRun: flags.dryRun,
        observers: {
          onStart: (details) => {
            if (flags.dryRun) {
              resources.logger.dryRun(`Would ${details.label.toLowerCase()}`);
            }
          },
          onComplete: (details, outcome) => {
            if (!flags.dryRun && outcome.changed) {
              resources.logger.verbose(details.label);
            }
          }
        }
      });

      resources.context.complete({
        success: `Removed MCP configuration from ${resolvedAgent}.`,
        dry: `Would remove MCP configuration from ${resolvedAgent}.`
      });
      resources.context.finalize();
    });
}

async function runMcpServer(
  container: CliContainer,
  profile: McpAgentProfile
): Promise<void> {
  const apiKey = await loadCredentials({
    fs: container.fs,
    filePath: container.env.credentialsPath
  });
  if (!apiKey) {
    process.stderr.write("No credentials found. Run 'poe-code login' first.\n");
    process.exit(1);
  }

  await initializeClient({
    fs: container.fs,
    credentialsPath: container.env.credentialsPath,
    baseUrl: container.env.poeApiBaseUrl,
    httpClient: container.httpClient
  });

  await runMcpServerWithTransport(profile);
}
