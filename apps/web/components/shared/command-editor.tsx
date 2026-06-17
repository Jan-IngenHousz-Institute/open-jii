"use client";

import { autocompletion, completionStatus, startCompletion } from "@codemirror/autocomplete";
import { EditorState } from "@codemirror/state";
import { EditorView, hoverTooltip, placeholder as placeholderExt } from "@codemirror/view";
import CodeMirror from "@uiw/react-codemirror";
import { useMemo } from "react";

import {
  buildCommandTooltipDom,
  commandCompletionSource,
  knownCommandAt,
} from "./command-completions";

/** Hover tooltip showing the description of a known command under the cursor. */
const commandHover = hoverTooltip((view, pos) => {
  const hit = knownCommandAt(view.state.doc.toString(), pos);
  if (!hit) return null;
  return {
    pos: hit.from,
    end: hit.to,
    above: true,
    create: () => ({ dom: buildCommandTooltipDom(hit.option) }),
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
  // Autocomplete popup: wider list, command grows so the group is pushed to
  // the right edge (clear gap between the command and its group label).
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
      autocompletion({
        override: [commandCompletionSource],
        icons: false,
        activateOnTyping: true,
      }),
      commandHover,
      // Open the completion list when the field is focused. Defer past the
      // focus/click tick so the view is actually focused — otherwise the list
      // only appears on a second focus (tab away + back).
      EditorView.domEventHandlers({
        focus: (_event, view) => {
          if (readOnly) return false;
          setTimeout(() => {
            if (view.hasFocus && completionStatus(view.state) === null) startCompletion(view);
          }, 0);
          return false;
        },
      }),
      ...(placeholder ? [placeholderExt(placeholder)] : []),
    ],
    [readOnly, placeholder],
  );

  return (
    <div
      className={
        className ??
        "focus-within:border-jii-dark-green w-full rounded-md border border-gray-300 bg-white"
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
