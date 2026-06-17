"use client";

import { autocompletion, completionStatus, startCompletion } from "@codemirror/autocomplete";
import type { Completion, CompletionContext, CompletionResult } from "@codemirror/autocomplete";
import { EditorState } from "@codemirror/state";
import { EditorView, hoverTooltip, keymap, placeholder as placeholderExt } from "@codemirror/view";
import CodeMirror from "@uiw/react-codemirror";
import { useMemo } from "react";

import type { DeviceCommandOption } from "@repo/api/schemas/device-command.schema";
import { KNOWN_DEVICE_COMMANDS } from "@repo/api/schemas/device-command.schema";

const COMMANDS: readonly DeviceCommandOption[] = KNOWN_DEVICE_COMMANDS;

/** Word under `pos` (a contiguous run of non-whitespace), or null. */
function wordAt(doc: string, pos: number): { from: number; to: number; text: string } | null {
  let from = pos;
  let to = pos;
  while (from > 0 && /\S/.test(doc[from - 1])) from--;
  while (to < doc.length && /\S/.test(doc[to])) to++;
  if (from === to) return null;
  return { from, to, text: doc.slice(from, to) };
}

/** Completion source offering the known device commands with their descriptions. */
function commandCompletionSource(context: CompletionContext): CompletionResult | null {
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

/** Hover tooltip showing the description of a known command under the cursor. */
const commandHover = hoverTooltip((view, pos) => {
  const word = wordAt(view.state.doc.toString(), pos);
  if (!word) return null;
  const option = COMMANDS.find((c) => c.value === word.text);
  if (!option) return null;
  return {
    pos: word.from,
    end: word.to,
    above: true,
    create() {
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
      return { dom };
    },
  };
});

// Keep the command on a single line — strip any newline-introducing transaction.
const singleLine = EditorState.transactionFilter.of((tr) => (tr.newDoc.lines > 1 ? [] : tr));

const editorTheme = EditorView.theme({
  "&": { fontSize: "14px" },
  ".cm-content": {
    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, monospace',
    padding: "8px 0",
  },
  "&.cm-focused": { outline: "none" },
  ".cm-line": { padding: "0 8px" },
});

interface CommandEditorProps {
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  placeholder?: string;
  "aria-label"?: string;
  className?: string;
}

/**
 * Single-line code editor for MultispeQ console commands. Free text, with
 * autocomplete + hover hints sourced from the known device commands.
 */
export function CommandEditor({
  value,
  onChange,
  readOnly = false,
  placeholder,
  "aria-label": ariaLabel,
  className,
}: CommandEditorProps) {
  const extensions = useMemo(
    () => [
      singleLine,
      editorTheme,
      autocompletion({ override: [commandCompletionSource], icons: false }),
      commandHover,
      // Open the completion list as soon as the field is focused while editing.
      EditorView.domEventHandlers({
        focus: (_event, view) => {
          if (!readOnly && completionStatus(view.state) === null) startCompletion(view);
          return false;
        },
      }),
      keymap.of([]),
      ...(placeholder ? [placeholderExt(placeholder)] : []),
    ],
    [readOnly, placeholder],
  );

  return (
    <div
      className={
        className ??
        "focus-within:border-jii-dark-green w-full max-w-md rounded-md border border-gray-300 bg-white"
      }
    >
      <CodeMirror
        value={value}
        onChange={onChange}
        readOnly={readOnly}
        editable={!readOnly}
        extensions={extensions}
        aria-label={ariaLabel}
        basicSetup={{
          lineNumbers: false,
          foldGutter: false,
          highlightActiveLine: false,
          highlightActiveLineGutter: false,
          autocompletion: false,
          bracketMatching: false,
          closeBrackets: false,
          searchKeymap: false,
          history: !readOnly,
        }}
      />
    </div>
  );
}
