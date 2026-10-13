import type { Ref } from "react";

import { cn } from "@repo/ui/lib/utils";

interface CodeEditorPlaceholderProps {
  ref?: Ref<HTMLPreElement>;
  value: string;
  density?: "compact";
  height?: string;
  minHeight?: string;
  maxHeight?: string;
}

/** The code as plain text, in the editor's type and spacing, until CodeMirror has loaded. */
export function CodeEditorPlaceholder({
  ref,
  value,
  density,
  height,
  minHeight,
  maxHeight,
}: CodeEditorPlaceholderProps) {
  return (
    <pre
      ref={ref}
      aria-busy="true"
      className={cn(
        "text-foreground m-0 overflow-hidden whitespace-pre-wrap break-words pl-12 pr-4 font-mono leading-5",
        density === "compact" ? "py-3 text-[13px]" : "py-4 text-sm",
      )}
      style={{ height, minHeight, maxHeight }}
    >
      {value}
    </pre>
  );
}
