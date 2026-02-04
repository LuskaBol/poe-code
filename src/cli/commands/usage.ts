import type { Command } from "commander";
import type { CliContainer } from "../container.js";
import { createExecutionResources, resolveCommandFlags } from "./shared.js";
import { loadCredentials } from "../../services/credentials.js";
import { AuthenticationError, ApiError } from "../errors.js";

export function registerUsageCommand(
  program: Command,
  container: CliContainer
): void {
  const usage = program
    .command("usage")
    .description("Check Poe API usage information.");

  usage
    .command("balance")
    .description("Display current point balance.")
    .action(async () => {
      const flags = resolveCommandFlags(program);
      const resources = createExecutionResources(
        container,
        flags,
        "usage:balance"
      );

      resources.logger.intro("usage balance");

      try {
        const apiKey = await loadCredentials({
          fs: container.fs,
          filePath: container.env.credentialsPath
        });

        if (!apiKey) {
          throw new AuthenticationError(
            "Poe API key not found. Run 'poe-code login' first."
          );
        }

        if (flags.dryRun) {
          resources.logger.dryRun(
            "Dry run: would fetch usage balance from Poe API."
          );
          return;
        }

        const response = await container.httpClient(
          `${container.env.poeApiBaseUrl}/usage/current_balance`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${apiKey}`
            }
          }
        );

        if (!response.ok) {
          throw new ApiError(
            `Failed to fetch usage balance (HTTP ${response.status})`,
            {
              httpStatus: response.status,
              endpoint: "/usage/current_balance"
            }
          );
        }

        const data = (await response.json()) as {
          monthly_available_balance: number;
        };
        const formatted = data.monthly_available_balance.toLocaleString(
          "en-US"
        );

        resources.logger.info(`Current balance: ${formatted} points`);
      } catch (error) {
        if (error instanceof Error) {
          resources.logger.logException(error, "usage balance", {
            operation: "fetch-balance"
          });
        }
        throw error;
      }
    });
}
