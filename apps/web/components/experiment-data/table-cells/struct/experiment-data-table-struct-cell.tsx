"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import React, { useRef } from "react";

import { Button, Collapsible, CollapsibleTrigger } from "@repo/ui/components";

interface ExperimentDataTableStructCellProps {
  data: string; // JSON string representation of the struct
  columnName: string;
  rowId: string;
  isExpanded: boolean;
  onToggleExpansion?: (rowId: string, columnName: string) => void;
}

type ParsedStructData = Record<string, unknown>;

function parseStructData(data: string): ParsedStructData | null {
  try {
    const parsed = JSON.parse(data) as unknown;
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return parsed as ParsedStructData;
    }
  } catch {
    return null;
  }
  return null;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "null";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return "[object]";
}

export function ExperimentDataTableStructCell({
  data,
  columnName,
  rowId,
  isExpanded,
  onToggleExpansion,
}: ExperimentDataTableStructCellProps) {
  const cellRef = useRef<HTMLDivElement>(null);

  const parsedData = parseStructData(data);

  // If we can't parse the data as a struct, just display it as text
  if (!parsedData) {
    return <span className="text-sm">{data}</span>;
  }

  const fields = Object.entries(parsedData);
  const fieldCount = fields.length;

  return (
    <div ref={cellRef} className="relative">
      <Collapsible open={isExpanded} onOpenChange={() => onToggleExpansion?.(rowId, columnName)}>
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
          <span className="muted-foreground text-sm">
            {fieldCount} {fieldCount === 1 ? "field" : "fields"}
          </span>
        </div>
      </Collapsible>
    </div>
  );
}

interface StructExpandedContentProps {
  data: string;
}

// Simplified expanded content for table row rendering
export function StructExpandedContent({ data }: StructExpandedContentProps) {
  const parsed = parseStructData(data);

  if (!parsed) {
    return null;
  }

  const fields = Object.entries(parsed);

  return (
    <div className="w-full p-4">
      <div className="w-full rounded border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
        <div className="space-y-1">
          {fields.map(([key, value]) => (
            <div key={key} className="flex gap-2 text-sm">
              <span className="font-medium text-gray-700 dark:text-gray-300">{key}:</span>
              <span className="text-gray-600 dark:text-gray-400">{formatValue(value)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
