import { parse as parseYaml } from "yaml";

import type { CommandFormat } from "../schemas/experiment.schema";

export interface InlineCommand {
  format: CommandFormat;
  content: string;
}

export type ResolvedCommand = string | Record<string, unknown> | unknown[];

/**
 * Resolve an inline command payload into what the device driver expects.
 * `string` is sent raw (e.g. `hello`, `battery`); `json`/`yaml` parse into a
 * command-shaped object/array. Throws on malformed JSON/YAML so callers can
 * surface a useful error instead of sending garbage to the instrument.
 */
export function resolveInlineCommand({ format, content }: InlineCommand): ResolvedCommand {
  switch (format) {
    case "string":
      return content;
    case "json":
      return JSON.parse(content) as ResolvedCommand;
    case "yaml":
      return parseYaml(content) as ResolvedCommand;
  }
}

/** Non-throwing variant for editor validation. */
export function validateInlineCommand({
  format,
  content,
}: InlineCommand): { ok: true; value: ResolvedCommand } | { ok: false; error: string } {
  if (content.trim().length === 0) {
    return { ok: false, error: "Command content is required" };
  }
  try {
    return { ok: true, value: resolveInlineCommand({ format, content }) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Invalid command content" };
  }
}
