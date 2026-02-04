import { describe, it, expect } from "vitest";
import chalk from "chalk";
import { renderTableMarkdown } from "./table.js";
import type { ThemePalette } from "../tokens/colors.js";

const identity = (s: string) => s;
const theme: ThemePalette = {
  header: identity,
  divider: identity,
  prompt: identity,
  number: identity,
  intro: identity,
  resolvedSymbol: "",
  errorSymbol: "",
  accent: identity,
  muted: identity,
  success: identity,
  warning: identity,
  error: identity,
  info: identity,
};

describe("renderTableMarkdown", () => {
  it("renders a basic markdown table with headers and rows", () => {
    const result = renderTableMarkdown({
      theme,
      columns: [
        { name: "Name", title: "Name", alignment: "left", maxLen: 20 },
        { name: "Value", title: "Value", alignment: "left", maxLen: 10 },
      ],
      rows: [
        { Name: "alpha", Value: "1" },
        { Name: "beta", Value: "2" },
      ],
    });

    const lines = result.split("\n");
    expect(lines[0]).toBe("| Name | Value |");
    expect(lines[1]).toBe("| :--- | :--- |");
    expect(lines[2]).toBe("| alpha | 1 |");
    expect(lines[3]).toBe("| beta | 2 |");
    expect(lines).toHaveLength(4);
  });

  it("respects column alignment", () => {
    const result = renderTableMarkdown({
      theme,
      columns: [
        { name: "Left", title: "Left", alignment: "left", maxLen: 10 },
        { name: "Right", title: "Right", alignment: "right", maxLen: 10 },
      ],
      rows: [{ Left: "a", Right: "b" }],
    });

    const lines = result.split("\n");
    expect(lines[1]).toBe("| :--- | ---: |");
  });

  it("strips ANSI escape codes from cell values", () => {
    const result = renderTableMarkdown({
      theme,
      columns: [
        { name: "Name", title: "Name", alignment: "left", maxLen: 20 },
      ],
      rows: [{ Name: chalk.red("colored") }],
    });

    const lines = result.split("\n");
    expect(lines[2]).toBe("| colored |");
  });

  it("handles empty rows", () => {
    const result = renderTableMarkdown({
      theme,
      columns: [
        { name: "Col", title: "Col", alignment: "left", maxLen: 10 },
      ],
      rows: [],
    });

    const lines = result.split("\n");
    expect(lines[0]).toBe("| Col |");
    expect(lines[1]).toBe("| :--- |");
    expect(lines).toHaveLength(2);
  });

  it("escapes pipe characters in cell content", () => {
    const result = renderTableMarkdown({
      theme,
      columns: [
        { name: "Expr", title: "Expr", alignment: "left", maxLen: 20 },
      ],
      rows: [{ Expr: "a | b" }],
    });

    const lines = result.split("\n");
    expect(lines[2]).toBe("| a \\| b |");
  });
});
