"use client";

import type { Diagnostic } from "@codemirror/lint";
import type { Extension } from "@codemirror/state";
import { oneDark } from "@codemirror/theme-one-dark";
import { EditorView } from "@codemirror/view";
import { useEffect, useMemo, useState } from "react";
import { CodeEditor } from "~/components/shared/code-editor";
import type { CodeLanguage, LintSource } from "~/components/shared/code-editor";

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
}

const compactTheme = EditorView.theme({
  "&": { fontSize: "13px" },
  ".cm-content": { padding: "12px 0" },
});

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
}: WorkbookCodeEditorProps) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    setIsDark(root.classList.contains("dark"));
    const observer = new MutationObserver(() => {
      setIsDark(root.classList.contains("dark"));
    });
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const extraExtensions = useMemo(() => {
    const exts: Extension[] = [compactTheme];
    if (isDark) exts.push(oneDark);
    return exts;
  }, [isDark]);

  return (
    <div
      className={`rounded-md border ${
        isDark ? "border-zinc-700 bg-zinc-900" : "border-zinc-200 bg-white"
      } ${className}`}
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
        lintSource={lintSource}
        syntaxLinting={syntaxLinting}
        extraExtensions={extraExtensions}
      />
    </div>
  );
}
