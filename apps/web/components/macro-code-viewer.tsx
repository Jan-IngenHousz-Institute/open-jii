"use client";

import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { Check, Copy, Pencil } from "lucide-react";
import React from "react";
import type { FC } from "react";
import { CodeEditor } from "~/components/shared/code-editor";
import type { CodeLanguage } from "~/components/shared/code-editor";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";

interface MacroCodeViewerProps {
  value: string;
  language: CodeLanguage;
  height?: string;
  className?: string;
  title?: React.ReactNode;
  onEditStart?: () => void;
}

const getLanguageLabel = (language: CodeLanguage): string => {
  switch (language) {
    case "python":
      return "Python";
    case "r":
      return "R";
    case "javascript":
      return "JavaScript";
    default:
      return language;
  }
};

export const MacroCodeViewer: FC<MacroCodeViewerProps> = ({
  value,
  language,
  height = "400px",
  className = "",
  title,
  onEditStart,
}) => {
  const { copy: copyToClipboard, copied } = useCopyToClipboard();
  const { t } = useTranslation();

  const handleCopy = async () => {
    await copyToClipboard(value);
  };

  const getCodeStats = () => {
    const lines = value.split("\n").length;
    const size = new Blob([value]).size;
    const formatSize = (bytes: number) => {
      if (bytes < 1024) return `${bytes} ${t("common.bytes")}`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} ${t("common.kilobytes")}`;
      return `${(bytes / (1024 * 1024)).toFixed(1)} ${t("common.megabytes")}`;
    };
    return { lines, size: formatSize(size) };
  };

  const stats = getCodeStats();

  return (
    <div className={`grid w-full gap-1.5 ${className}`}>
      <div
        className={`group/viewer relative overflow-hidden rounded-md border border-slate-200 shadow-sm transition-shadow duration-200 hover:shadow-md ${onEditStart ? "cursor-pointer" : ""}`}
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
          <div className="flex items-center gap-2">
            {title && <span className="text-sm font-medium text-slate-700">{title}</span>}
            {title && <span className="text-slate-300">|</span>}
            <span className="text-xs font-medium text-slate-600">{getLanguageLabel(language)}</span>
            <div className="text-xs text-slate-500">
              {stats.lines} {t("common.lines")} - {stats.size}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                void handleCopy();
              }}
              className="h-8 px-2 text-slate-600 hover:text-slate-800"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Editor */}
        <div style={{ height }}>
          <CodeEditor
            value={value}
            language={language}
            height={height}
            readOnly
            basicSetup={{
              highlightActiveLineGutter: false,
              highlightActiveLine: false,
              closeBrackets: false,
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default MacroCodeViewer;
