"use client";

import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { Check, Copy } from "lucide-react";
import React from "react";
import type { FC } from "react";
import { CodeEditor } from "~/components/shared/code-editor";
import type { CodeLanguage } from "~/components/shared/code-editor";

import { Button } from "@repo/ui/components/button";
import { Label } from "@repo/ui/components/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/ui/components/tooltip";

interface MacroCodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language: CodeLanguage;
  label?: string;
  error?: string;
  height?: string;
  title?: React.ReactNode;
  headerActions?: React.ReactNode;
}

const MacroCodeEditor: FC<MacroCodeEditorProps> = ({
  value,
  onChange,
  language,
  label,
  error,
  height = "400px",
  title,
  headerActions,
}) => {
  const { copy: copyToClipboard, copied } = useCopyToClipboard();

  const handleCopy = async () => {
    await copyToClipboard(value);
  };

  const getCodeStats = () => {
    const lines = value.split("\n").length;
    const size = new Blob([value]).size;
    const formatSize = (bytes: number) => {
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };
    return { lines, size: formatSize(size) };
  };

  const stats = getCodeStats();
  const errorClass = error ? " border-red-500" : "";

  return (
    <div className="grid w-full gap-1.5">
      {label && <Label>{label}</Label>}
      <div
        className={`shadow-xs overflow-hidden rounded-md border border-slate-200 transition-shadow duration-200 hover:shadow-md${errorClass}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-100 px-4 py-2">
          <div className="flex items-center gap-2">
            {title && <span className="text-sm font-medium text-slate-700">{title}</span>}
            {title && <span className="text-slate-300">|</span>}
            <div className="text-xs text-slate-500">
              {stats.lines} lines - {stats.size}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {headerActions}
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleCopy}
                    className="h-8 px-2 text-slate-600 hover:text-slate-800"
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">{copied ? "Copied!" : "Copy code"}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {/* Editor */}
        <div style={{ height }}>
          <CodeEditor
            value={value}
            onChange={onChange}
            language={language}
            height={height}
            syntaxLinting
            lintDelay={500}
          />
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
};

export default MacroCodeEditor;
