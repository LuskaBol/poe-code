import * as clack from "@clack/prompts";
import { text as textComponent } from "../components/text.js";
import { resolveOutputFormat } from "../internal/output-format.js";

export { isCancel, cancel, log } from "@clack/prompts";

function stripAnsi(value: string): string {
  return value.replace(/\u001b\[[0-9;]*m/g, "");
}

export function intro(title: string): void {
  const format = resolveOutputFormat();
  if (format === "markdown") {
    process.stdout.write(`# ${stripAnsi(title)}\n\n`);
    return;
  }
  if (format === "json") {
    return;
  }
  clack.intro(textComponent.intro(title));
}

export function introPlain(title: string): void {
  const format = resolveOutputFormat();
  if (format === "markdown") {
    process.stdout.write(`# ${stripAnsi(title)}\n\n`);
    return;
  }
  if (format === "json") {
    return;
  }
  clack.intro(title);
}

export function outro(message: string): void {
  if (resolveOutputFormat() !== "terminal") {
    return;
  }
  clack.outro(message);
}

export function note(message: string, title?: string): void {
  if (resolveOutputFormat() !== "terminal") {
    return;
  }
  clack.note(message, title);
}

export type SelectOptions<Value> = Parameters<typeof clack.select<Value>>[0];

export async function select<Value>(
  opts: SelectOptions<Value>
): Promise<Value | symbol> {
  return clack.select(opts);
}

export type TextOptions = Parameters<typeof clack.text>[0];

export async function text(opts: TextOptions): Promise<string | symbol> {
  return clack.text(opts);
}

export type ConfirmOptions = Parameters<typeof clack.confirm>[0];

export async function confirm(opts: ConfirmOptions): Promise<boolean | symbol> {
  return clack.confirm(opts);
}

export type PasswordOptions = Parameters<typeof clack.password>[0];

export async function password(opts: PasswordOptions): Promise<string | symbol> {
  return clack.password(opts);
}

export type SpinnerOptions = {
  start: (message?: string) => void;
  stop: (message?: string, code?: number) => void;
  message: (message?: string) => void;
};

export function spinner(): SpinnerOptions {
  return clack.spinner();
}
