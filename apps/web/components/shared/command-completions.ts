import type { Completion, CompletionContext, CompletionResult } from "@codemirror/autocomplete";
import { autocompletion, completionStatus, startCompletion } from "@codemirror/autocomplete";
import type { Extension } from "@codemirror/state";
import { EditorState } from "@codemirror/state";
import type { Tooltip } from "@codemirror/view";
import { EditorView, hoverTooltip, placeholder as placeholderExt } from "@codemirror/view";

import type { DeviceCommandOption } from "@repo/api/domains/workbook/device-command.schema";
import { KNOWN_DEVICE_COMMANDS } from "@repo/api/domains/workbook/device-command.schema";

const COMMANDS: readonly DeviceCommandOption[] = KNOWN_DEVICE_COMMANDS;

// Built once: the completion source runs on nearly every keystroke.
const COMPLETION_OPTIONS: Completion[] = COMMANDS.map((c) => ({
  label: c.value,
  detail: c.group,
  info: c.description,
  type: "keyword",
}));

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

  return { from: word.from, options: COMPLETION_OPTIONS, validFor: /^\S*$/ };
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

/** Hover-tooltip source: the description of a known command under the cursor. */
export function commandHoverSource(view: EditorView, pos: number): Tooltip | null {
  const hit = knownCommandAt(view.state.doc.toString(), pos);
  if (!hit) return null;
  return {
    pos: hit.from,
    end: hit.to,
    above: true,
    create: () => ({ dom: buildCommandTooltipDom(hit.option) }),
  };
}

/** Hover tooltip showing the description of a known command under the cursor. */
const commandHover = hoverTooltip(commandHoverSource);

// Keep the command on a single line; strip any newline-introducing transaction.
const singleLineFilter = EditorState.transactionFilter.of((tr) => (tr.newDoc.lines > 1 ? [] : tr));

// Autocomplete popup: command grows so the group label is pushed to the right edge.
const completionPopupTheme = EditorView.theme({
  ".cm-tooltip-autocomplete": { minWidth: "340px" },
  ".cm-tooltip-autocomplete > ul": { minWidth: "340px", maxHeight: "18rem" },
  ".cm-tooltip-autocomplete > ul > li": {
    display: "flex",
    alignItems: "center",
    padding: "3px 10px",
  },
  ".cm-completionLabel": { flex: "1 1 auto" },
  ".cm-completionDetail": {
    flex: "0 0 auto",
    marginLeft: "auto",
    paddingLeft: "1.5rem",
    fontStyle: "italic",
    opacity: "0.6",
  },
});

interface CommandExtensionOptions {
  /** Constrain the document to a single line (for the free-text `string` format). */
  singleLine?: boolean;
  placeholder?: string;
  readOnly?: boolean;
}

/**
 * Focus handler that opens the completion list once the editor is focused.
 * Deferred past the focus/click tick so the view is actually focused; otherwise
 * the list only appears on a second focus (tab away + back). Always returns
 * false so the event keeps propagating.
 */
export function openCompletionsOnFocus(readOnly: boolean) {
  return (_event: FocusEvent, view: EditorView): boolean => {
    if (readOnly) return false;
    setTimeout(() => {
      if (view.hasFocus && completionStatus(view.state) === null) startCompletion(view);
    }, 0);
    return false;
  };
}

/**
 * CodeMirror extensions that turn a plain editor into a known-command input:
 * autocomplete + hover hints sourced from {@link KNOWN_DEVICE_COMMANDS}. Suggestions
 * only; any string can still be typed. Fold these into an existing editor instead
 * of maintaining a separate command-editor component.
 */
export function buildCommandExtensions({
  singleLine = false,
  placeholder,
  readOnly = false,
}: CommandExtensionOptions = {}): Extension[] {
  return [
    ...(singleLine ? [singleLineFilter] : []),
    completionPopupTheme,
    autocompletion({
      override: [commandCompletionSource],
      icons: false,
      activateOnTyping: true,
    }),
    commandHover,
    EditorView.domEventHandlers({ focus: openCompletionsOnFocus(readOnly) }),
    ...(placeholder ? [placeholderExt(placeholder)] : []),
  ];
}
