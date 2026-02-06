"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import React, { useRef } from "react";

import { Button, Collapsible, CollapsibleTrigger } from "@repo/ui/components";

interface ExperimentDataTableArrayCellProps {
  data: string; // JSON string representation of the array
  columnName: string;
  rowId: string;
  isExpanded: boolean;
  onToggleExpansion?: (rowId: string, columnName: string) => void;
}

type ParsedArrayData = Record<string, unknown>[];

function parseArrayData(data: string): ParsedArrayData | null {
  try {
    // Try to parse as JSON first
    const parsed = JSON.parse(data) as unknown;
    if (Array.isArray(parsed)) {
      return parsed as ParsedArrayData;
    }
  } catch {
    // If JSON parsing fails, return null
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

export function ExperimentDataTableArrayCell({
  data,
  columnName,
  rowId,
  isExpanded,
  onToggleExpansion,
}: ExperimentDataTableArrayCellProps) {
  const cellRef = useRef<HTMLDivElement>(null);

  const parsedData = parseArrayData(data);

  // If we can't parse the data as an array, just display it as text
  if (!parsedData) {
    return <span className="text-sm">{data}</span>;
  }

  const itemCount = parsedData.length;

  // If it's empty, show empty message
  if (itemCount === 0) {
    return <span className="muted-foreground text-sm">Empty array</span>;
  }

  // If there's only one item, show it inline
  if (itemCount === 1) {
    const item = parsedData[0];
    const entries = Object.entries(item);
    if (entries.length === 1) {
      const [key, value] = entries[0];
      return (
        <div className="text-sm">
          <span className="font-medium">{key}:</span> {formatValue(value)}
        </div>
      );
    }
  }

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
            {itemCount} {itemCount === 1 ? "item" : "items"}
          </span>
        </div>
      </Collapsible>
    </div>
  );
}

interface ArrayExpandedContentProps {
  data: string;
}

// New: Simplified expanded content for table row rendering
export function ArrayExpandedContent({ data }: ArrayExpandedContentProps) {
  const items = parseArrayData(data);

  if (!items) {
    return null;
  }

  return (
    <div className="w-full p-4">
      <div className="w-full space-y-3">
        {items.map((item, index) => (
          <div
            key={index}
            className="rounded border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900"
          >
            <div className="space-y-1">
              {Object.entries(item).map(([key, value]) => (
                <div key={key} className="flex gap-2 text-sm">
                  <span className="font-medium text-gray-700 dark:text-gray-300">{key}:</span>
                  <span className="text-gray-600 dark:text-gray-400">{formatValue(value)}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
