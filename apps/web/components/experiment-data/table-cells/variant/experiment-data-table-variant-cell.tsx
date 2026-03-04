"use client";

import { Check, ChevronDown, ChevronRight, Copy } from "lucide-react";
import React, { useState } from "react";

import { useTranslation } from "@repo/i18n";
import { Button, Collapsible, CollapsibleTrigger } from "@repo/ui/components";

interface ExperimentDataTableVariantCellProps {
  data: string; // JSON string representation of the variant data
  columnName: string;
  rowId: string;
  isExpanded: boolean;
  onToggleExpansion?: (rowId: string, columnName: string) => void;
}

/**
 * Check if a string is structured JSON (object or array).
 * Returns true only for JSON objects and arrays — not for scalar values
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

export function ExperimentDataTableVariantCell({
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
  const [copied, setCopied] = useState(false);
  let formatted: string;
  try {
    const parsed: unknown = JSON.parse(data);
    formatted = JSON.stringify(parsed, null, 2);
  } catch {
    formatted = data;
  }

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(data);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <div className="relative w-full p-4">
      <Button
        variant="ghost"
        size="sm"
        className="z-1 absolute right-12 top-8 h-7 border bg-white/90 px-2 shadow-sm backdrop-blur-sm hover:bg-white dark:bg-gray-800/90 dark:hover:bg-gray-800"
        onClick={handleCopy}
        title={t("common.copy")}
      >
        {copied ? (
          <>
            <Check className="mr-1 h-3 w-3 text-green-600" />
            <span className="text-xs text-green-600">{t("common.copied")}</span>
          </>
        ) : (
          <>
            <Copy className="mr-1 h-3 w-3" />
            <span className="text-xs">{t("common.copy")}</span>
          </>
        )}
      </Button>
      <pre className="max-h-96 w-full overflow-x-auto overflow-y-auto rounded border border-gray-200 bg-white p-3 font-mono text-xs dark:border-gray-700 dark:bg-gray-900">
        <code className="text-gray-800 dark:text-gray-200">{formatted}</code>
      </pre>
    </div>
  );
}
