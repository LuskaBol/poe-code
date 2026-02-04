import type { Command } from "commander";
import type { CliContainer } from "../container.js";
import { createExecutionResources, resolveCommandFlags } from "./shared.js";
import { loadCredentials } from "../../services/credentials.js";
import { AuthenticationError, ApiError } from "../errors.js";
import { Table } from "console-table-printer";
import { confirm, isCancel, getTheme, widths, typography } from "@poe-code/design-system";

async function executeBalance(
  program: Command,
  container: CliContainer
): Promise<void> {
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
      `${container.env.poeBaseUrl}/usage/current_balance`,
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
      current_point_balance: number;
    };
    const theme = getTheme();
    const formatted = data.current_point_balance.toLocaleString("en-US");
    const styledBalance = typography.bold(theme.accent(formatted));

    resources.logger.info(`Current balance: ${styledBalance} points`);
    resources.logger.feedback(
      "Need more points?",
      "https://poe.com/api/keys"
    );
  } catch (error) {
    if (error instanceof Error) {
      resources.logger.logException(error, "usage balance", {
        operation: "fetch-balance"
      });
    }
    throw error;
  }
}

export function registerUsageCommand(
  program: Command,
  container: CliContainer
): void {
  const usage = program
    .command("usage")
    .description("Check Poe API usage information.")
    .action(async () => {
      await executeBalance(program, container);
    });

  usage
    .command("balance")
    .description("Display current point balance.")
    .action(async () => {
      await executeBalance(program, container);
    });

  usage
    .command("list")
    .description("Display usage history.")
    .option("--filter <model>", "Filter results by model name")
    .option("--all", "Load all pages without prompting")
    .action(async function (this: Command) {
      const flags = resolveCommandFlags(program);
      const resources = createExecutionResources(
        container,
        flags,
        "usage:list"
      );
      const commandOptions = this.opts<{ filter?: string; all?: boolean }>();

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
          query_id: string;
          creation_time: number;
          bot_name: string;
          cost_points: number;
        }> = [];
        let startingAfter: string | undefined;

        while (true) {
          let url = `${container.env.poeBaseUrl}/usage/points_history?limit=20`;
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
              query_id: string;
              creation_time: number;
              bot_name: string;
              cost_points: number;
            }>;
          };

          allEntries.push(...result.data);

          if (!result.has_more || result.data.length === 0) {
            break;
          }

          startingAfter = result.data[result.data.length - 1].query_id;

          if (!commandOptions.all) {
            const shouldContinue = await confirm({ message: "Load more?" });
            if (isCancel(shouldContinue) || !shouldContinue) {
              break;
            }
          }
        }

        const filterTerm = commandOptions.filter;
        const displayEntries = filterTerm
          ? allEntries.filter((entry) =>
              entry.bot_name.toLowerCase().includes(filterTerm.toLowerCase())
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

        const dateWidth = 16;
        const costWidth = 10;
        const tableChrome = 10;
        const modelMaxWidth = widths.maxLine - dateWidth - costWidth - tableChrome;

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
            { name: "Date", title: theme.header("Date"), alignment: "left", maxLen: dateWidth },
            { name: "Model", title: theme.header("Model"), alignment: "left", maxLen: modelMaxWidth },
            { name: "Cost", title: theme.header("Cost"), alignment: "right", maxLen: costWidth }
          ]
        });

        for (const entry of displayEntries) {
          const date = new Date(entry.creation_time / 1000);
          const year = date.getUTCFullYear();
          const month = String(date.getUTCMonth() + 1).padStart(2, "0");
          const day = String(date.getUTCDate()).padStart(2, "0");
          const hours = String(date.getUTCHours()).padStart(2, "0");
          const minutes = String(date.getUTCMinutes()).padStart(2, "0");
          const formatted = `${year}-${month}-${day} ${hours}:${minutes}`;

          const modelName = entry.bot_name.length > modelMaxWidth
            ? entry.bot_name.slice(0, modelMaxWidth - 1) + "\u2026"
            : entry.bot_name;

          table.addRow({
            Date: theme.muted(formatted),
            Model: theme.accent(modelName),
            Cost:
              entry.cost_points < 0
                ? theme.error(String(entry.cost_points))
                : theme.success(String(entry.cost_points))
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
