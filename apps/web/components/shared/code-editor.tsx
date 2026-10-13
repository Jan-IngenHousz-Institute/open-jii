"use client";

import { lazy, Suspense } from "react";

import { useInView } from "@repo/ui/hooks/use-in-view";

import { CodeEditorPlaceholder } from "./code-editor-placeholder";
import type { CodeEditorProps } from "./code-editor-view";

export type { CodeEditorProps, CodeLanguage, Diagnostic, LintSource } from "./code-editor-view";

// CodeMirror is about 230 KB gzipped and draws nothing on the server, so pages ship without it
// and show the code as text until it arrives.
const CodeEditorView = lazy(() =>
  import("./code-editor-view").then((module) => ({ default: module.CodeEditorView })),
);

// A screen ahead, as dashboard widgets do. Mounting every editor of a long workbook in one commit
// blocked the page for half a second at 4x CPU.
const ROOT_MARGIN = "100% 0px";

export function CodeEditor(props: CodeEditorProps) {
  // False on the server and while hydrating, so both render the same placeholder.
  const [placeholderRef, isNearViewport] = useInView<HTMLPreElement>({ rootMargin: ROOT_MARGIN });

  const placeholder = (
    <CodeEditorPlaceholder
      ref={placeholderRef}
      value={props.value}
      density={props.density}
      height={props.height}
      minHeight={props.minHeight}
      maxHeight={props.maxHeight}
    />
  );

  if (!isNearViewport) {
    return placeholder;
  }

  return (
    <Suspense fallback={placeholder}>
      <CodeEditorView {...props} />
    </Suspense>
  );
}
