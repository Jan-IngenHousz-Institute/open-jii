import type { Completion, CompletionContext, CompletionResult } from "@codemirror/autocomplete";

import type { DeviceCommandOption } from "@repo/api/schemas/device-command.schema";
import { KNOWN_DEVICE_COMMANDS } from "@repo/api/schemas/device-command.schema";

const COMMANDS: readonly DeviceCommandOption[] = KNOWN_DEVICE_COMMANDS;

/** Word under `pos` (a contiguous run of non-whitespace), or null. */
export function wordAt(
  doc: string,
  pos: number,
): { from: number; to: number; text: string } | null {
  let from = pos;
  let to = pos;
  while (from > 0 && /\S/.test(doc[from - 1])) from--;
  while (to < doc.length && /\S/.test(doc[to])) to++;
  if (from === to) return null;
  return { from, to, text: doc.slice(from, to) };
}

/** Completion source offering the known device commands with their descriptions. */
export function commandCompletionSource(context: CompletionContext): CompletionResult | null {
  const word = context.matchBefore(/\S*/);
  if (!word) return null;
  // Only auto-open once the user types, but allow explicit (Ctrl-Space) on empty.
  if (word.from === word.to && !context.explicit) return null;

  const options: Completion[] = COMMANDS.map((c) => ({
    label: c.value,
    detail: c.group,
    info: c.description,
    type: "keyword",
  }));

  return { from: word.from, options, validFor: /^\S*$/ };
}

/** Known command under `pos`, or null when none / unknown. */
export function knownCommandAt(
  doc: string,
  pos: number,
): { option: DeviceCommandOption; from: number; to: number } | null {
  const word = wordAt(doc, pos);
  if (!word) return null;
  const option = COMMANDS.find((c) => c.value === word.text);
  if (!option) return null;
  return { option, from: word.from, to: word.to };
}

/** Build the hover-tooltip DOM (command · group + description) for a command. */
export function buildCommandTooltipDom(option: DeviceCommandOption): HTMLElement {
  const dom = document.createElement("div");
  dom.className = "px-2 py-1 text-xs";
  const title = document.createElement("div");
  title.className = "font-mono font-medium";
  title.textContent = `${option.value} · ${option.group}`;
  dom.appendChild(title);
  if (option.description) {
    const desc = document.createElement("div");
    desc.className = "text-muted-foreground mt-0.5";
    desc.textContent = option.description;
    dom.appendChild(desc);
  }
  return dom;
}
