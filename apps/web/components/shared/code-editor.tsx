"use client";

import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
import { python } from "@codemirror/lang-python";
import { StreamLanguage, syntaxTree } from "@codemirror/language";
import { r } from "@codemirror/legacy-modes/mode/r";
import { forceLinting, lintGutter, linter } from "@codemirror/lint";
import type { Diagnostic } from "@codemirror/lint";
import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import CodeMirror from "@uiw/react-codemirror";
import { useCallback, useMemo } from "react";

export type CodeLanguage = "json" | "javascript" | "python" | "r" | "markdown";
export type { Diagnostic };

/** Lint source that receives the document string and returns diagnostics. */
export type LintSource = (doc: string) => Diagnostic[];

const getLanguageExtension = (language: CodeLanguage) => {
  switch (language) {
    case "json":
      return json();
    case "javascript":
      return javascript();
    case "python":
      return python();
    case "r":
      return StreamLanguage.define(r);
    case "markdown":
      return markdown();
  }
};

const baseTheme = EditorView.theme({
  "&": { fontSize: "14px" },
  ".cm-content": {
    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, monospace',
    padding: "16px 0",
    lineHeight: "20px",
  },
  ".cm-gutters": {
    backgroundColor: "transparent",
    borderRight: "none",
    paddingRight: "8px",
    overflow: "visible",
  },
  ".cm-gutter-lint .cm-gutterElement": {
    padding: "0 4px !important",
  },
  ".cm-gutterElement": { padding: "0 8px 0 16px !important" },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": { overflow: "auto" },
  ".cm-lintRange-error": {
    backgroundImage: "none",
    textDecoration: "underline wavy #e53e3e",
    textDecorationSkipInk: "none",
    textUnderlineOffset: "3px",
  },
  ".cm-lintRange-warning": {
    backgroundImage: "none",
    textDecoration: "underline wavy #d97706",
    textDecorationSkipInk: "none",
    textUnderlineOffset: "3px",
  },
  ".cm-diagnostic": {
    padding: "4px 8px",
    fontSize: "13px",
  },
  ".cm-diagnostic-error": {
    borderLeft: "3px solid #e53e3e",
  },
  ".cm-diagnostic-warning": {
    borderLeft: "3px solid #d97706",
  },
});

/**
 * Built-in syntax linter using Lezer parse tree error nodes.
 * Works with languages that have a full Lezer parser (JS, Python, JSON).
 * StreamLanguage-based languages (R) produce minimal error info.
 */
export function createSyntaxLinter(delay = 500) {
  return linter(
    (view) => {
      const diagnostics: Diagnostic[] = [];
      const doc = view.state.doc;
      const tree = syntaxTree(view.state);
      const errorLines = new Set<number>();

      tree.iterate({
        enter: (node) => {
          if (node.type.isError) {
            const line = doc.lineAt(node.from);
            if (errorLines.has(line.number)) return;
            errorLines.add(line.number);

            const lineText = line.text;
            const firstNonSpace = lineText.search(/\S/);
            const from = firstNonSpace >= 0 ? line.from + firstNonSpace : line.from;
            const to = line.from + lineText.length;

            if (from < to) {
              diagnostics.push({
                from,
                to,
                severity: "error",
                message: `Syntax error on line ${line.number}`,
              });
            }
          }
        },
      });
      return diagnostics;
    },
    { delay },
  );
}

interface CodeEditorProps {
  value: string;
  onChange?: (value: string) => void;
  language: CodeLanguage;
  readOnly?: boolean;
  height?: string;
  minHeight?: string;
  maxHeight?: string;
  lintSource?: LintSource;
  lintDelay?: number;
  syntaxLinting?: boolean;
  extraExtensions?: Extension[];
  onCreateEditor?: (view: EditorView) => void;
  basicSetup?: {
    lineNumbers?: boolean;
    highlightActiveLineGutter?: boolean;
    highlightActiveLine?: boolean;
    foldGutter?: boolean;
    bracketMatching?: boolean;
    closeBrackets?: boolean;
    autocompletion?: boolean;
    indentOnInput?: boolean;
    tabSize?: number;
    syntaxHighlighting?: boolean;
  };
}

export function CodeEditor({
  value,
  onChange,
  language,
  readOnly = false,
  height,
  minHeight,
  maxHeight,
  lintSource,
  lintDelay = 300,
  syntaxLinting = false,
  extraExtensions,
  onCreateEditor,
  basicSetup: basicSetupOverrides,
}: CodeEditorProps) {
  const handleChange = useCallback(
    (val: string) => {
      onChange?.(val);
    },
    [onChange],
  );

  const extensions = useMemo(() => {
    const exts: Extension[] = [getLanguageExtension(language), EditorView.lineWrapping, baseTheme];

    const hasLinting = !!(lintSource ?? syntaxLinting);
    if (hasLinting) {
      exts.push(lintGutter());
    }

    if (lintSource) {
      exts.push(linter((view) => lintSource(view.state.doc.toString()), { delay: lintDelay }));
    } else if (syntaxLinting) {
      exts.push(createSyntaxLinter(lintDelay));
    }

    if (extraExtensions) {
      exts.push(...extraExtensions);
    }

    return exts;
  }, [language, lintSource, syntaxLinting, lintDelay, extraExtensions]);

  const hasLinting = !!(lintSource ?? syntaxLinting);

  const handleCreateEditor = useCallback(
    (view: EditorView) => {
      if (hasLinting) {
        setTimeout(() => forceLinting(view), 100);
      }
      onCreateEditor?.(view);
    },
    [hasLinting, onCreateEditor],
  );

  const tabSize =
    basicSetupOverrides?.tabSize ?? (language === "python" || language === "r" ? 4 : 2);

  return (
    <CodeMirror
      value={value}
      onChange={handleChange}
      onCreateEditor={handleCreateEditor}
      readOnly={readOnly}
      editable={!readOnly}
      height={height}
      minHeight={minHeight}
      maxHeight={maxHeight}
      extensions={extensions}
      basicSetup={{
        lineNumbers: basicSetupOverrides?.lineNumbers ?? true,
        highlightActiveLineGutter: basicSetupOverrides?.highlightActiveLineGutter ?? !readOnly,
        highlightActiveLine: basicSetupOverrides?.highlightActiveLine ?? !readOnly,
        foldGutter: basicSetupOverrides?.foldGutter ?? true,
        bracketMatching: basicSetupOverrides?.bracketMatching ?? true,
        closeBrackets: basicSetupOverrides?.closeBrackets ?? !readOnly,
        autocompletion: basicSetupOverrides?.autocompletion ?? false,
        indentOnInput: basicSetupOverrides?.indentOnInput ?? true,
        syntaxHighlighting: basicSetupOverrides?.syntaxHighlighting ?? true,
        tabSize,
      }}
    />
  );
}
