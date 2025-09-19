"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import React, { useState, useRef, useEffect } from "react";

import { Button, Collapsible, CollapsibleTrigger } from "@repo/ui/components";

interface ExperimentDataTableMapCellProps {
  data: string; // JSON string representation of the map
  _columnName: string;
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
  return "[object]";
}

export function ExperimentDataTableMapCell({ data, _columnName }: ExperimentDataTableMapCellProps) {
  const [isOpen, setIsOpen] = useState(false);
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
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="flex items-center gap-1">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
              {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </Button>
          </CollapsibleTrigger>
          <span className="muted-foreground text-sm">
            {entryCount} {entryCount === 1 ? "entry" : "entries"}
          </span>
        </div>

        {/* Use a portal-like approach by finding the table row and inserting after it */}
        {isOpen && <MapExpandedContent entries={entries} cellRef={cellRef} />}
      </Collapsible>
    </div>
  );
}

interface MapExpandedContentProps {
  entries: [string, unknown][];
  cellRef: React.RefObject<HTMLDivElement | null>;
}

function MapExpandedContent({ entries, cellRef }: MapExpandedContentProps) {
  useEffect(() => {
    const cellElement = cellRef.current;
    if (!cellElement) return;

    // Find the table row that contains this cell
    const tableRow = cellElement.closest("tr");
    const table = cellElement.closest("table");

    if (!tableRow || !table) return;

    // Create the expanded row element
    const expandedRow = document.createElement("tr");
    expandedRow.className = "map-expanded-row";

    // Count the number of columns in the table
    const columnCount = tableRow.children.length;

    // Create a single cell that spans all columns
    const expandedCell = document.createElement("td");
    expandedCell.colSpan = columnCount;
    expandedCell.className =
      "p-0 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700";

    // Create the content container
    const contentDiv = document.createElement("div");
    contentDiv.className = "p-4";

    // Create the grid container
    const gridDiv = document.createElement("div");
    gridDiv.className = "grid gap-2";

    // Add each entry as a row
    entries.forEach(([key, value]) => {
      const entryDiv = document.createElement("div");
      entryDiv.className = "grid grid-cols-[auto_1fr] gap-3 text-sm";

      const keySpan = document.createElement("span");
      keySpan.className = "min-w-0 font-medium text-gray-900 dark:text-gray-100";
      keySpan.textContent = `${key}:`;

      const valueSpan = document.createElement("span");
      valueSpan.className = "min-w-0 break-words text-gray-600 dark:text-gray-400";
      valueSpan.textContent = formatValue(value);

      entryDiv.appendChild(keySpan);
      entryDiv.appendChild(valueSpan);
      gridDiv.appendChild(entryDiv);
    });

    contentDiv.appendChild(gridDiv);
    expandedCell.appendChild(contentDiv);
    expandedRow.appendChild(expandedCell);

    // Insert the expanded row after the current row
    tableRow.parentNode?.insertBefore(expandedRow, tableRow.nextSibling);

    // Cleanup function to remove the expanded row
    return () => {
      expandedRow.remove();
    };
  }, [entries, cellRef]);

  return null; // This component doesn't render anything directly
}
