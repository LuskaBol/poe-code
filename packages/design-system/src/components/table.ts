import { Table } from "console-table-printer";
import type { ThemePalette } from "../tokens/colors.js";

export interface TableColumn {
  name: string;
  title: string;
  alignment: "left" | "right";
  maxLen: number;
}

export interface RenderTableOptions {
  theme: ThemePalette;
  columns: TableColumn[];
  rows: Record<string, string>[];
}

export function renderTable(options: RenderTableOptions): string {
  const { theme, columns, rows } = options;

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
    columns: columns.map((col) => ({
      name: col.name,
      title: theme.header(col.title),
      alignment: col.alignment,
      maxLen: col.maxLen
    }))
  });

  for (const row of rows) {
    table.addRow(row);
  }

  return table.render();
}
