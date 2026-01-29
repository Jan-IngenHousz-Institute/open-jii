"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import React, { useRef } from "react";

import { Button, Collapsible, CollapsibleTrigger } from "@repo/ui/components";

interface ExperimentDataTableMapCellProps {
  data: string; // JSON string representation of the map
  columnName: string;
  rowId: string;
  isExpanded: boolean;
  onToggleExpansion?: (rowId: string, columnName: string) => void;
}

type ParsedMapData = Record<string, unknown>;

function parseMapData(data: string): ParsedMapData | null {
  try {
    // Try to parse as JSON first
    const parsed = JSON.parse(data) as unknown;
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return parsed as ParsedMapData;
    }
  } catch {
    // If JSON parsing fails, try to parse simple key-value format
    // Example: "key1=value1,key2=value2" or "{key1: value1, key2: value2}"
    try {
      // Remove surrounding braces if present
      const cleaned = data.trim().replace(/^{|}$/g, "");
      const pairs = cleaned.split(",");
      const result: ParsedMapData = {};

      for (const pair of pairs) {
        const [key, ...valueParts] = pair.split(/[:=]/);
        if (key && valueParts.length > 0) {
          const value = valueParts.join(":").trim();
          result[key.trim()] = value;
        }
      }

      return Object.keys(result).length > 0 ? result : null;
    } catch {
      return null;
    }
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
  return "[objecet]";
}

export function ExperimentDataTableMapCell({
  data,
  columnName,
  rowId,
  isExpanded,
  onToggleExpansion,
}: ExperimentDataTableMapCellProps) {
  const cellRef = useRef<HTMLDivElement>(null);

  const parsedData = parseMapData(data);

  // If we can't parse the data as a map, just display it as text
  if (!parsedData) {
    return <span className="text-sm">{data}</span>;
  }

  const entries = Object.entries(parsedData);
  const entryCount = entries.length;

  // If there's only one entry or it's empty, don't make it collapsible
  if (entryCount <= 1) {
    if (entryCount === 0) {
      return <span className="muted-foreground text-sm">Empty map</span>;
    }
    const [key, value] = entries[0];
    return (
      <div className="text-sm">
        <span className="font-medium">{key}:</span> {formatValue(value)}
      </div>
    );
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
            {entryCount} {entryCount === 1 ? "entry" : "entries"}
          </span>
        </div>
      </Collapsible>
    </div>
  );
}

interface MapExpandedContentProps {
  data: string;
}

// New: Simplified expanded content for table row rendering
export function MapExpandedContent({ data }: MapExpandedContentProps) {
  const parsed = parseMapData(data);

  if (!parsed) {
    return null;
  }

  const entries = Object.entries(parsed);

  return (
    <div className="w-full p-4">
      <div className="w-full rounded border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
        <div className="space-y-1">
          {entries.map(([key, value]) => (
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
