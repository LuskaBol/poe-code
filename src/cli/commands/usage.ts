import type { Command } from "commander";
import type { CliContainer } from "../container.js";
import { createExecutionResources, resolveCommandFlags } from "./shared.js";
import { loadCredentials } from "../../services/credentials.js";
import { AuthenticationError, ApiError } from "../errors.js";
import { Table } from "console-table-printer";

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

  usage
    .command("list")
    .description("Display usage history.")
    .action(async () => {
      const flags = resolveCommandFlags(program);
      const resources = createExecutionResources(
        container,
        flags,
        "usage:list"
      );

      resources.logger.intro("usage list");

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
            "Dry run: would fetch usage history from Poe API."
          );
          return;
        }

        const response = await container.httpClient(
          `${container.env.poeApiBaseUrl}/usage/points_history?limit=20`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${apiKey}`
            }
          }
        );

        if (!response.ok) {
          throw new ApiError(
            `Failed to fetch usage history (HTTP ${response.status})`,
            {
              httpStatus: response.status,
              endpoint: "/usage/points_history"
            }
          );
        }

        const result = (await response.json()) as {
          has_more: boolean;
          length: number;
          data: Array<{
            timestamp: string;
            model: string;
            cost: number;
          }>;
        };

        resources.logger.info(
          `Usage History (${result.data.length} entries)`
        );

        const table = new Table({
          columns: [
            { name: "Date", alignment: "left" },
            { name: "Model", alignment: "left" },
            { name: "Cost", alignment: "right" }
          ]
        });

        for (const entry of result.data) {
          const date = new Date(entry.timestamp);
          const year = date.getUTCFullYear();
          const month = String(date.getUTCMonth() + 1).padStart(2, "0");
          const day = String(date.getUTCDate()).padStart(2, "0");
          const hours = String(date.getUTCHours()).padStart(2, "0");
          const minutes = String(date.getUTCMinutes()).padStart(2, "0");
          const formatted = `${year}-${month}-${day} ${hours}:${minutes}`;

          table.addRow({
            Date: formatted,
            Model: entry.model,
            Cost: entry.cost
          });
        }

        resources.logger.info(table.render());
      } catch (error) {
        if (error instanceof Error) {
          resources.logger.logException(error, "usage list", {
            operation: "fetch-history"
          });
        }
        throw error;
      }
    });
}
