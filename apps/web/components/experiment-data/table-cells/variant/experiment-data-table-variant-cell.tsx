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

function formatJsonValue(data: string): { formatted: string; isValid: boolean } {
  try {
    const parsed: unknown = JSON.parse(data);
    return {
      formatted: JSON.stringify(parsed, null, 2),
      isValid: true,
    };
  } catch {
    // If not valid JSON, just return the original string
    return {
      formatted: data,
      isValid: false,
    };
  }
}

export function ExperimentDataTableVariantCell({
  data,
  columnName,
  rowId,
  isExpanded,
  onToggleExpansion,
}: ExperimentDataTableVariantCellProps) {
  const { isValid } = formatJsonValue(data);

  // If it's not valid JSON or empty, just display as text
  if (!isValid || !data || data.trim() === "") {
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
