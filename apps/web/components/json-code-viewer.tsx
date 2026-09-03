"use client";

import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { Check, Copy } from "lucide-react";
import { useMemo } from "react";
import type { FC } from "react";
import { CodeEditor } from "~/components/shared/code-editor";
import { CodeViewerFrame } from "~/components/shared/code-viewer-frame";
import { JsonFormatToggle } from "~/components/shared/json-format-toggle";
import { useJsonFormatStyle } from "~/hooks/useJsonFormatStyle";
import { formatJson, reformatJsonString } from "~/lib/json-format";

import { Button } from "@repo/ui/components/button";

interface JsonCodeViewerProps {
  value: unknown;
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
  const { style, toggleStyle } = useJsonFormatStyle();

  // Convert value to formatted JSON string
  const jsonString = useMemo(
    () =>
      typeof value === "string"
        ? reformatJsonString(value, { style })
        : formatJson(value, { style }),
    [value, style],
  );

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
    <CodeViewerFrame
      label="JSON"
      title={title}
      stats={`${stats.lines} lines - ${stats.size}`}
      onEditStart={onEditStart}
      className={className}
      actions={
        <>
          <JsonFormatToggle style={style} onToggle={toggleStyle} />
          <Button
            variant="ghost"
            size="icon-sm"
            data-testid="json-copy-button"
            onClick={(e) => {
              e.stopPropagation();
              void handleCopy();
            }}
          >
            {copied ? <Check className="text-primary size-3" /> : <Copy className="size-3" />}
          </Button>
        </>
      }
    >
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
    </CodeViewerFrame>
  );
};
