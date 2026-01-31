"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import React from "react";

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
  let formatted: string;
  try {
    const parsed: unknown = JSON.parse(data);
    formatted = JSON.stringify(parsed, null, 2);
  } catch {
    formatted = data;
  }

  return (
    <div className="w-full p-4">
      <pre className="max-h-96 w-full overflow-x-auto overflow-y-auto rounded border border-gray-200 bg-white p-3 font-mono text-xs dark:border-gray-700 dark:bg-gray-900">
        <code className="text-gray-800 dark:text-gray-200">{formatted}</code>
      </pre>
    </div>
  );
}
