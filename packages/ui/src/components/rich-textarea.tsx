"use client";

import "quill/dist/quill.snow.css";
import React, { useEffect, useRef } from "react";
import { useQuill } from "react-quilljs";

export function RichTextarea({
  value,
  onChange,
  placeholder,
  isDisabled,
  autoFocus,
  onBlur,
  releaseTabKey,
  compact,
}: {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  isDisabled?: boolean;
  autoFocus?: boolean;
  onBlur?: (e: React.FocusEvent) => void;
  /**
   * When true, Tab and Shift+Tab move focus to the next/previous
   * focusable element instead of being captured by Quill (which would
   * otherwise indent/outdent lists or insert tab characters). Use this
   * inside form-like flows where consistent Tab navigation matters more
   * than list indentation (e.g. inside a dashboard editor where Tab
   * should walk between widgets).
   */
  releaseTabKey?: boolean;
  /**
   * When true, the editor fills its parent (instead of the default
   * 300px-tall textarea look) and the toolbar is forced into a single
   * horizontally-scrollable row. Use inside layouts where the editor
   * has to live in a small, resizable container (e.g. a dashboard
   * widget), so the toolbar doesn't wrap to four rows and the editor
   * doesn't bleed past its container's height.
   */
  compact?: boolean;
}) {
  const { quill, quillRef } = useQuill({
    theme: "snow",
    modules: {
      // The header dropdown is replaced with two toggle buttons in compact
      // mode. Quill's picker opens its options as `position: absolute;
      // top: 100%`, which gets clipped if the toolbar wraps or has any
      // overflow management. Toggle buttons sidestep the entire popover
      // problem and read fine at narrow widths.
      toolbar: compact
        ? [
            ["bold", "italic", "underline"],
            [{ header: 1 }, { header: 2 }, { header: 3 }],
            [{ list: "ordered" }, { list: "bullet" }],
            ["link", "code", "blockquote"],
            ["clean"],
          ]
        : [
            ["bold", "italic", "underline"],
            [{ header: [1, 2, 3, false] }],
            [{ list: "ordered" }, { list: "bullet" }],
            ["link"],
            ["code"],
            ["blockquote"],
            ["clean"],
          ],
    },
    formats: [
      "header",
      "bold",
      "italic",
      "underline",
      "list",
      "link",
      "code",
      "code-block",
      "blockquote",
    ],
    placeholder: isDisabled ? "" : (placeholder ?? "Write something awesome..."),
  });

  // Hold the latest onChange in a ref so the text-change handler stays
  // bound for the lifetime of the editor; re-registering on every render
  // caused the focus + selection to reset on each keystroke.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Prevent toolbar buttons from stealing focus on click; keeps the
  // selection inside the editor while the user formats.
  useEffect(() => {
    if (!quill) return;

    const toolbar = quill.getModule("toolbar") as { container: HTMLElement };
    const preventFocus = (e: MouseEvent) => {
      e.preventDefault();
    };
    toolbar.container.addEventListener("mousedown", preventFocus);
    return () => {
      toolbar.container.removeEventListener("mousedown", preventFocus);
    };
  }, [quill]);

  // Mount-time setup: seed the initial content, autofocus once, register
  // the text-change handler exactly once. Reading from the ref avoids
  // re-registering when the parent re-renders.
  useEffect(() => {
    if (!quill) return;

    if (value && quill.root.innerHTML !== value) {
      quill.root.innerHTML = value;
    }

    const handleTextChange = () => {
      const html = quill.root.innerHTML;
      onChangeRef.current(html);
    };

    quill.on("text-change", handleTextChange);

    if (autoFocus) {
      quill.focus();
      // Place the caret at the end so typing doesn't insert at position 0
      // (Quill defaults the cursor to the start on initial focus).
      const length = quill.getLength();
      quill.setSelection(length, 0);
    }

    return () => {
      quill.off("text-change", handleTextChange);
    };
    // Intentionally only depend on `quill`. `value`/`autoFocus` are seed
    // inputs; re-running on every value change would reset the cursor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quill]);

  // Sync external value changes (programmatic reset, prefill from server)
  // only when the incoming value differs from what Quill already shows.
  useEffect(() => {
    if (!quill) return;
    if (quill.root.innerHTML === value) return;
    // Preserve cursor position when the user is mid-edit. Snapshot before,
    // restore after.
    const selection = quill.getSelection();
    quill.root.innerHTML = value || "";
    if (selection) {
      const length = quill.getLength();
      const safeIndex = Math.min(selection.index, length);
      quill.setSelection(safeIndex, selection.length);
    }
  }, [quill, value]);

  // Enable/disable in its own effect so toggling isDisabled doesn't tear
  // down the text-change handler.
  useEffect(() => {
    if (!quill) return;
    quill.enable(!isDisabled);
  }, [quill, isDisabled]);

  // Optionally let Tab leave the editor. Intercept keydown in the capture
  // phase and stop Quill's listener without preventing default so the
  // browser still moves focus.
  useEffect(() => {
    if (!quill || !releaseTabKey) return;
    const root = quill.root;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Tab") {
        e.stopImmediatePropagation();
      }
    };
    root.addEventListener("keydown", onKeyDown, true);
    return () => {
      root.removeEventListener("keydown", onKeyDown, true);
    };
  }, [quill, releaseTabKey]);

  return (
    <div
      // In compact mode the wrapper fills its parent; in default mode it
      // keeps the legacy 300px-tall textarea look.
      className={
        compact
          ? "border-input focus-visible:ring-ring shadow-xs focus-visible:outline-hidden flex h-full w-full flex-col overflow-hidden rounded-md border bg-transparent text-sm focus-visible:ring-1 disabled:cursor-not-allowed disabled:opacity-50"
          : "border-input focus-visible:ring-ring shadow-xs focus-visible:outline-hidden flex w-full flex-col overflow-hidden rounded-md border bg-transparent text-base focus-visible:ring-1 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
      }
      data-rta-compact={compact ? "" : undefined}
      onBlur={onBlur}
    >
      <div
        ref={quillRef}
        className={
          compact
            ? "min-h-0 w-full flex-1 overflow-hidden"
            : "max-h-[300px] min-h-[300px] w-full overflow-hidden"
        }
        role="textbox"
        aria-label={placeholder ?? "Rich text editor"}
        aria-placeholder={placeholder ?? "Write something awesome..."}
        style={{
          display: "flex",
          flexDirection: "column",
        }}
      />
      <style>
        {`
          .ql-container {
            flex: 1;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            border: none;
          }
          .ql-toolbar {
            border-bottom: 1px solid var(--border);
            border-top: none;
            border-left: none;
            border-right: none;
          }
          .ql-editor {
            flex: 1;
            overflow-y: auto;
            overflow-x: hidden;
            padding: 12px;
            word-break: break-word;
            white-space: pre-wrap;
            border: none;
          }
          .ql-editor blockquote {
            border-left: 4px solid var(--border);
            margin-bottom: 5px;
            margin-top: 5px;
            padding-left: 16px;
            font-style: italic;
          }
          .ql-editor code {
            background-color: var(--muted);
            padding: 2px 4px;
            border-radius: 3px;
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
          }
          .ql-editor pre {
            background-color: var(--muted);
            padding: 10px;
            border-radius: 5px;
            overflow-x: auto;
          }

          /* Quill's snow theme hardcodes its whole palette — a dark placeholder,
             #444 toolbar glyphs, #06c accents, white dropdown and tooltip
             surfaces. All of it is invisible or wrong on a dark card, so the
             theme's colours are restated here against the contract. Only
             colour is overridden; the snow theme still owns layout. */
          .ql-editor.ql-blank::before {
            color: var(--muted-foreground);
            font-style: normal;
          }
          .ql-editor .ql-code-block-container {
            background-color: var(--muted);
            color: var(--foreground);
          }
          .ql-snow a,
          .ql-editor a {
            color: var(--primary);
          }
          .ql-snow .ql-picker {
            color: var(--foreground);
          }
          .ql-snow .ql-stroke,
          .ql-snow .ql-stroke-miter {
            stroke: var(--muted-foreground);
          }
          .ql-snow .ql-fill,
          .ql-snow .ql-stroke.ql-fill {
            fill: var(--muted-foreground);
          }
          .ql-snow.ql-toolbar button:hover,
          .ql-snow .ql-toolbar button:hover,
          .ql-snow.ql-toolbar button:focus,
          .ql-snow .ql-toolbar button:focus,
          .ql-snow.ql-toolbar button.ql-active,
          .ql-snow .ql-toolbar button.ql-active,
          .ql-snow.ql-toolbar .ql-picker-label:hover,
          .ql-snow.ql-toolbar .ql-picker-label.ql-active,
          .ql-snow.ql-toolbar .ql-picker-item:hover,
          .ql-snow.ql-toolbar .ql-picker-item.ql-selected {
            color: var(--primary);
          }
          .ql-snow.ql-toolbar button:hover .ql-stroke,
          .ql-snow.ql-toolbar button:focus .ql-stroke,
          .ql-snow.ql-toolbar button.ql-active .ql-stroke,
          .ql-snow.ql-toolbar .ql-picker-label:hover .ql-stroke,
          .ql-snow.ql-toolbar .ql-picker-label.ql-active .ql-stroke,
          .ql-snow.ql-toolbar button:hover .ql-stroke-miter,
          .ql-snow.ql-toolbar button.ql-active .ql-stroke-miter {
            stroke: var(--primary);
          }
          .ql-snow.ql-toolbar button:hover .ql-fill,
          .ql-snow.ql-toolbar button:focus .ql-fill,
          .ql-snow.ql-toolbar button.ql-active .ql-fill,
          .ql-snow.ql-toolbar .ql-picker-label:hover .ql-fill,
          .ql-snow.ql-toolbar .ql-picker-item.ql-selected .ql-fill {
            fill: var(--primary);
          }
          .ql-snow .ql-picker-options {
            background-color: var(--popover);
            color: var(--popover-foreground);
            border-color: var(--border);
          }
          .ql-toolbar.ql-snow .ql-picker.ql-expanded .ql-picker-label,
          .ql-toolbar.ql-snow .ql-picker.ql-expanded .ql-picker-options {
            border-color: var(--border);
          }
          .ql-snow .ql-tooltip {
            background-color: var(--popover);
            color: var(--popover-foreground);
            border-color: var(--border);
            box-shadow: var(--shadow-md);
          }
          .ql-snow .ql-tooltip input[type="text"] {
            background-color: transparent;
            color: var(--foreground);
            border-color: var(--input);
          }

          /* Compact mode: smaller buttons + a single-row, horizontally-
             scrollable toolbar so it never eats more than ~32px of vertical
             space regardless of widget width. Safe to scroll horizontally
             now that the heading dropdown is replaced with toggle buttons
             since the heading dropdown is replaced with toggle buttons. */
          [data-rta-compact] .ql-toolbar {
            display: flex;
            flex-wrap: nowrap;
            overflow-x: auto;
            overflow-y: hidden;
            padding: 4px 6px;
            scrollbar-width: thin;
          }
          [data-rta-compact] .ql-toolbar::-webkit-scrollbar {
            height: 4px;
          }
          [data-rta-compact] .ql-toolbar::-webkit-scrollbar-thumb {
            background: var(--border);
            border-radius: 2px;
          }
          [data-rta-compact] .ql-toolbar .ql-formats {
            display: inline-flex;
            flex-shrink: 0;
            margin-right: 6px;
          }
          [data-rta-compact] .ql-toolbar .ql-formats:last-child {
            margin-right: 0;
          }
          [data-rta-compact] .ql-toolbar button {
            width: 24px;
            height: 24px;
            padding: 2px;
          }
          [data-rta-compact] .ql-editor {
            padding: 8px 10px;
            font-size: 13px;
          }
        `}
      </style>
    </div>
  );
}
