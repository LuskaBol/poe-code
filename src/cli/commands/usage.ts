import type { Command } from "commander";
import type { CliContainer } from "../container.js";
import { createExecutionResources, resolveCommandFlags } from "./shared.js";
import { loadCredentials } from "../../services/credentials.js";
import { AuthenticationError, ApiError } from "../errors.js";
import { Table } from "console-table-printer";
import { confirm, isCancel, getTheme } from "@poe-code/design-system";

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
    .option("--filter <model>", "Filter results by model name")
    .action(async function (this: Command) {
      const flags = resolveCommandFlags(program);
      const resources = createExecutionResources(
        container,
        flags,
        "usage:list"
      );
      const commandOptions = this.opts<{ filter?: string }>();

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

        const allEntries: Array<{
          id: string;
          timestamp: string;
          model: string;
          cost: number;
        }> = [];
        let startingAfter: string | undefined;

        while (true) {
          let url = `${container.env.poeApiBaseUrl}/usage/points_history?limit=20`;
          if (startingAfter) {
            url += `&starting_after=${startingAfter}`;
          }

          const response = await container.httpClient(url, {
            method: "GET",
            headers: {
              Authorization: `Bearer ${apiKey}`
            }
          });

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
            data: Array<{
              id: string;
              timestamp: string;
              model: string;
              cost: number;
            }>;
          };

          allEntries.push(...result.data);

          if (!result.has_more || result.data.length === 0) {
            break;
          }

          startingAfter = result.data[result.data.length - 1].id;

          const shouldContinue = await confirm({ message: "Load more?" });
          if (isCancel(shouldContinue) || !shouldContinue) {
            break;
          }
        }

        const filterTerm = commandOptions.filter;
        const displayEntries = filterTerm
          ? allEntries.filter((entry) =>
              entry.model.toLowerCase().includes(filterTerm.toLowerCase())
            )
          : allEntries;

        if (allEntries.length === 0) {
          resources.logger.info("No usage history found.");
          return;
        }

        if (displayEntries.length === 0 && filterTerm) {
          resources.logger.info(`No entries match "${filterTerm}".`);
          return;
        }

        if (filterTerm) {
          resources.logger.info(
            `Usage History (${displayEntries.length} of ${allEntries.length} entries match "${filterTerm}")`
          );
        } else {
          resources.logger.info(
            `Usage History (${allEntries.length} entries)`
          );
        }

        const theme = getTheme();

        const table = new Table({
          style: {
            headerTop: {
              left: theme.muted("┌"),
              mid: theme.muted("┬"),
              right: theme.muted("┐"),
              other: theme.muted("─")
            },
            headerBottom: {
              left: theme.muted("├"),
              mid: theme.muted("┼"),
              right: theme.muted("┤"),
              other: theme.muted("─")
            },
            tableBottom: {
              left: theme.muted("└"),
              mid: theme.muted("┴"),
              right: theme.muted("┘"),
              other: theme.muted("─")
            },
            vertical: theme.muted("│"),
            rowSeparator: {
              left: theme.muted("├"),
              mid: theme.muted("┼"),
              right: theme.muted("┤"),
              other: theme.muted("─")
            }
          },
          columns: [
            { name: "Date", title: theme.header("Date"), alignment: "left" },
            { name: "Model", title: theme.header("Model"), alignment: "left" },
            { name: "Cost", title: theme.header("Cost"), alignment: "right" }
          ]
        });

        for (const entry of displayEntries) {
          const date = new Date(entry.timestamp);
          const year = date.getUTCFullYear();
          const month = String(date.getUTCMonth() + 1).padStart(2, "0");
          const day = String(date.getUTCDate()).padStart(2, "0");
          const hours = String(date.getUTCHours()).padStart(2, "0");
          const minutes = String(date.getUTCMinutes()).padStart(2, "0");
          const formatted = `${year}-${month}-${day} ${hours}:${minutes}`;

          table.addRow({
            Date: theme.muted(formatted),
            Model: theme.accent(entry.model),
            Cost:
              entry.cost < 0
                ? theme.error(String(entry.cost))
                : theme.success(String(entry.cost))
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
