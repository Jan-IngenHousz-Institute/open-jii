"use client";

import "quill/dist/quill.snow.css";
import React, { useEffect } from "react";
import { useQuill } from "react-quilljs";

export function RichTextarea({
  value,
  onChange,
  placeholder,
  isDisabled,
  autoFocus,
  onBlur,
}: {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  isDisabled?: boolean;
  autoFocus?: boolean;
  onBlur?: (e: React.FocusEvent) => void;
}) {
  const { quill, quillRef } = useQuill({
    theme: "snow",
    modules: {
      toolbar: [
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

  useEffect(() => {
    if (!quill) return;

    const toolbar = quill.getModule("toolbar") as { container: HTMLElement };

    if (toolbar?.container) {
      toolbar.container.addEventListener("mousedown", (e: MouseEvent) => {
        e.preventDefault();
      });
    }
    // Set initial value if provided
    if (value && quill.root.innerHTML !== value) {
      quill.root.innerHTML = value;
    }

    const handleTextChange = () => {
      const html = quill.root.innerHTML;
      if (html !== value) {
        onChange(html);
      }
    };

    quill.enable(!isDisabled);
    quill.on("text-change", handleTextChange);

    // Handle autofocus
    if (autoFocus) {
      quill.focus();
    }

    return () => {
      quill.off("text-change", handleTextChange);
    };
  }, [quill, onChange, value, isDisabled, autoFocus]);

  return (
    <div
      className="border-input focus-visible:ring-ring flex w-full flex-col rounded-md border bg-transparent text-base shadow-sm focus-visible:outline-none focus-visible:ring-1 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
      onBlur={onBlur}
    >
      <div
        ref={quillRef}
        className="max-h-[300px] min-h-[300px] w-full overflow-hidden"
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
            border-bottom: 1px solid #ccc;
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
            border-left: 4px solid #ccc;
            margin-bottom: 5px;
            margin-top: 5px;
            padding-left: 16px;
            font-style: italic;
          }
          .ql-editor code {
            background-color: #f4f4f4;
            padding: 2px 4px;
            border-radius: 3px;
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
          }
          .ql-editor pre {
            background-color: #f4f4f4;
            padding: 10px;
            border-radius: 5px;
            overflow-x: auto;
          }
        `}
      </style>
    </div>
  );
}
