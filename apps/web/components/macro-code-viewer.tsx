"use client";

import { CodeViewerFrame } from "@/components/shared/code-viewer-frame";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { Check, Copy } from "lucide-react";
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
      <CodeViewerFrame
        label={getLanguageLabel(language)}
        stats={`${stats.lines} ${t("common.lines")} - ${stats.size}`}
        title={title}
        onEditStart={onEditStart}
        actions={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              void handleCopy();
            }}
            className="text-muted-foreground hover:text-foreground h-8 px-2"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
        }
      >
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
      </CodeViewerFrame>
    </div>
  );
};

export default MacroCodeViewer;
