"use client";

import Editor from "@monaco-editor/react";
import { Copy, Check } from "lucide-react";
import { useState } from "react";
import type { FC } from "react";

import { Button } from "@repo/ui/components";

interface JsonCodeViewerProps {
  value: Record<string, unknown>[] | Record<string, unknown> | string;
  height?: string;
  className?: string;
}

export const JsonCodeViewer: FC<JsonCodeViewerProps> = ({
  value,
  height = "400px",
  className = "",
}) => {
  const [copied, setCopied] = useState(false);

  // Convert value to formatted JSON string
  const jsonString = typeof value === "string" ? value : JSON.stringify(value, null, 2);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(jsonString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
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
      className={`overflow-hidden rounded-md border border-slate-200 shadow-sm transition-shadow duration-200 hover:shadow-md ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-100 px-4 py-2">
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-slate-600">JSON</span>
          <span className="text-xs text-slate-500">
            {stats.lines} lines • {stats.size}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          className="h-7 w-7 p-0 hover:bg-slate-200"
        >
          {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
        </Button>
      </div>
      <Editor
        height={`calc(${height} - 41px)`}
        language="json"
        value={jsonString}
        loading={
          <div className="flex h-full items-center justify-center bg-slate-50">
            <div className="animate-pulse text-sm text-slate-600">
              Loading syntax highlighter...
            </div>
          </div>
        }
        options={{
          readOnly: true,
          minimap: { enabled: false },
          fontSize: 14,
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
          lineHeight: 1.6,
          scrollBeyondLastLine: false,
          automaticLayout: true,
          wordWrap: "on",
          lineNumbers: "on",
          folding: true,
          contextmenu: false,
          selectOnLineNumbers: false,
          glyphMargin: false,
          lineDecorationsWidth: 0,
          lineNumbersMinChars: 3,
          renderLineHighlight: "none",
          padding: { top: 16, bottom: 16 },
          scrollbar: {
            vertical: "auto",
            horizontal: "auto",
            verticalScrollbarSize: 10,
            horizontalScrollbarSize: 10,
            useShadows: true,
          },
          smoothScrolling: true,
          cursorBlinking: "phase",
          renderValidationDecorations: "off",
          hideCursorInOverviewRuler: true,
        }}
        theme="vs-light"
      />
    </div>
  );
};
