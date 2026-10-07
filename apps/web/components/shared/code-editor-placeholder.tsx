import { cn } from "@repo/ui/lib/utils";

interface CodeEditorPlaceholderProps {
  value: string;
  density?: "compact";
  height?: string;
  minHeight?: string;
  maxHeight?: string;
}

/** The code as plain text, in the editor's type and spacing, until CodeMirror has loaded. */
export function CodeEditorPlaceholder({
  value,
  density,
  height,
  minHeight,
  maxHeight,
}: CodeEditorPlaceholderProps) {
  return (
    <pre
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
