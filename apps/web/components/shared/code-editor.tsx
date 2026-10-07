"use client";

import { lazy, Suspense, useSyncExternalStore } from "react";

import { CodeEditorPlaceholder } from "./code-editor-placeholder";
import type { CodeEditorProps } from "./code-editor-view";

export type { CodeEditorProps, CodeLanguage, Diagnostic, LintSource } from "./code-editor-view";

// CodeMirror is about 230 KB gzipped and draws nothing on the server, so pages ship without it
// and show the code as text until it arrives.
const CodeEditorView = lazy(() =>
  import("./code-editor-view").then((module) => ({ default: module.CodeEditorView })),
);

const subscribeToNothing = () => () => undefined;

export function CodeEditor(props: CodeEditorProps) {
  // False on the server and while hydrating, so both render the same placeholder.
  const isHydrated = useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );

  const placeholder = (
    <CodeEditorPlaceholder
      value={props.value}
      density={props.density}
      height={props.height}
      minHeight={props.minHeight}
      maxHeight={props.maxHeight}
    />
  );

  if (!isHydrated) {
    return placeholder;
  }

  return (
    <Suspense fallback={placeholder}>
      <CodeEditorView {...props} />
    </Suspense>
  );
}
