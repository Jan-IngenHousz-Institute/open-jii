"use client";

import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { Check, Copy, Pencil } from "lucide-react";
import type { FC } from "react";
import { CodeEditor } from "~/components/shared/code-editor";

import { Button } from "@repo/ui/components/button";
import { cn } from "@repo/ui/lib/utils";

interface JsonCodeViewerProps {
  value: Record<string, unknown>[] | Record<string, unknown> | string;
  height?: string;
  className?: string;
  title?: React.ReactNode;
  onEditStart?: () => void;
}

export const JsonCodeViewer: FC<JsonCodeViewerProps> = ({
  value,
  height = "400px",
  className = "",
  title,
  onEditStart,
}) => {
  const { copy: copyToClipboard, copied } = useCopyToClipboard();

  // Convert value to formatted JSON string
  const jsonString = typeof value === "string" ? value : JSON.stringify(value, null, 2);

  const handleCopy = async () => {
    await copyToClipboard(jsonString);
  };

  const getJsonStats = () => {
    const lines = jsonString.split("\n").length;
    const size = new Blob([jsonString]).size;
    const formatSize = (bytes: number) => {
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };
    return { lines, size: formatSize(size) };
  };

  const stats = getJsonStats();

  return (
    <div
      data-testid="json-viewer-wrapper"
      className={cn(
        "group/viewer relative overflow-hidden rounded-md border border-slate-200 shadow-sm transition-shadow duration-200 hover:shadow-md",
        onEditStart && "cursor-pointer",
        className,
      )}
      onClick={onEditStart}
    >
      {/* Hover edit overlay */}
      {onEditStart && (
        <div className="pointer-events-none absolute inset-0 z-10 flex cursor-pointer items-center justify-center bg-black/0 transition-colors duration-200 group-hover/viewer:pointer-events-auto group-hover/viewer:bg-black/5">
          <div className="rounded-full bg-white p-3 opacity-0 shadow-lg transition-opacity duration-200 group-hover/viewer:opacity-100">
            <Pencil className="h-5 w-5 text-slate-600" />
          </div>
        </div>
      )}
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-100 px-4 py-2">
        <div className="flex items-center gap-3">
          {title && <span className="text-sm font-medium text-slate-700">{title}</span>}
          {title && <span className="text-slate-300">|</span>}
          <span className="text-xs font-medium text-slate-600">JSON</span>
          <span className="text-xs text-slate-500">
            {stats.lines} lines - {stats.size}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              void handleCopy();
            }}
            className="h-7 w-7 p-0 hover:bg-slate-200"
          >
            {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
          </Button>
        </div>
      </div>
      <CodeEditor
        value={jsonString}
        language="json"
        height={height}
        readOnly
        basicSetup={{
          highlightActiveLineGutter: false,
          highlightActiveLine: false,
          closeBrackets: false,
        }}
      />
    </div>
  );
};
