"use client";

import type { ComponentProps } from "react";
import { CodeEditor } from "~/components/shared/code-editor";
import type { CodeLanguage, Diagnostic, LintSource } from "~/components/shared/code-editor";

export type EditorLanguage = CodeLanguage;
export type { Diagnostic, LintSource };

interface WorkbookCodeEditorProps {
  value: string;
  onChange?: (value: string) => void;
  language: EditorLanguage;
  readOnly?: boolean;
  minHeight?: string;
  maxHeight?: string;
  className?: string;
  lintSource?: LintSource;
  syntaxLinting?: boolean;
  commandInputPlaceholder?: string;
  basicSetup?: ComponentProps<typeof CodeEditor>["basicSetup"];
}

export function WorkbookCodeEditor({
  value,
  onChange,
  language,
  readOnly = false,
  minHeight = "80px",
  maxHeight = "400px",
  className = "",
  lintSource,
  syntaxLinting = false,
  commandInputPlaceholder,
  basicSetup,
}: WorkbookCodeEditorProps) {
  // The dark token palette and the surface tokens live in `CodeEditor`, so
  // every editor and read-only viewer gets them, not just this one.
  return (
    <div
      className={`border-border bg-card rounded-md border ${className}`}
      style={{ minHeight, maxHeight }}
    >
      <CodeEditor
        value={value}
        onChange={onChange}
        language={language}
        readOnly={readOnly}
        height="auto"
        minHeight={minHeight}
        maxHeight={maxHeight}
        density="compact"
        lintSource={lintSource}
        syntaxLinting={syntaxLinting}
        commandInputPlaceholder={commandInputPlaceholder}
        basicSetup={basicSetup}
      />
    </div>
  );
}
