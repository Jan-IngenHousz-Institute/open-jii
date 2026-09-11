"use client";

import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { useJsonFormatStyle } from "@/hooks/useJsonFormatStyle";
import { reformatJsonString } from "@/lib/json-format";
import { Check, ChevronDown, ChevronRight, Copy } from "lucide-react";
import React from "react";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Collapsible, CollapsibleTrigger } from "@repo/ui/components/collapsible";

interface ExperimentDataTableVariantCellProps {
  data: string; // JSON string representation of the variant data
  columnName: string;
  rowId: string;
  isExpanded: boolean;
  onToggleExpansion?: (rowId: string, columnName: string) => void;
}

/**
 * Check if a string is structured JSON (object or array).
 * Returns true only for JSON objects and arrays, not for scalar values
 * like numbers, strings, booleans, or null which are valid JSON but should
 * be displayed as plain text.
 */
function isStructuredJson(data: string): boolean {
  try {
    const parsed: unknown = JSON.parse(data);
    return typeof parsed === "object" && parsed !== null;
  } catch {
    return false;
  }
}

export function DataTableVariantCell({
  data,
  columnName,
  rowId,
  isExpanded,
  onToggleExpansion,
}: ExperimentDataTableVariantCellProps) {
  // Only show collapsible JSON for structured data (objects/arrays).
  // Everything else (numbers, strings, booleans, invalid JSON) renders as plain text.
  if (!data || !isStructuredJson(data)) {
    return <span className="text-sm">{data}</span>;
  }

  const handleToggle = () => {
    onToggleExpansion?.(rowId, columnName);
  };

  return (
    <div className="relative">
      <Collapsible open={isExpanded} onOpenChange={handleToggle}>
        <div className="flex items-center gap-1">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
              {isExpanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </Button>
          </CollapsibleTrigger>
          <span className="muted-foreground text-sm">JSON</span>
        </div>
      </Collapsible>
    </div>
  );
}

// Expanded content component for rendering in table rows
export function VariantExpandedContent({ data }: { data: string }) {
  const { t } = useTranslation();
  const { copy: copyToClipboard, copied } = useCopyToClipboard();
  const { style } = useJsonFormatStyle();
  const formatted = reformatJsonString(data, { style });

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // What is on screen, matching the other JSON surfaces.
    await copyToClipboard(formatted);
  };

  return (
    <div className="relative w-full p-4">
      <Button
        variant="ghost"
        size="sm"
        // right-10, not right-6: the wrapper's p-4 puts the <pre>'s edge 16px in
        // and its scrollbar occupies the next ~16px, so a 24px offset lands on
        // top of it. The button sits outside the <pre>, so it does not scroll.
        className="z-1 shadow-xs backdrop-blur-xs bg-card/90 hover:bg-card absolute right-10 top-6 h-7 border px-2"
        onClick={handleCopy}
        title={t("common.copy")}
      >
        {copied ? (
          <>
            <Check className="text-status-active-foreground mr-1 h-3 w-3" />
            <span className="text-status-active-foreground text-xs">{t("common.copied")}</span>
          </>
        ) : (
          <>
            <Copy className="mr-1 h-3 w-3" />
            <span className="text-xs">{t("common.copy")}</span>
          </>
        )}
      </Button>
      <pre className="border-border bg-card max-h-96 w-full overflow-y-auto whitespace-pre-wrap break-words rounded border p-3 font-mono text-xs">
        <code className="text-foreground">{formatted}</code>
      </pre>
    </div>
  );
}
