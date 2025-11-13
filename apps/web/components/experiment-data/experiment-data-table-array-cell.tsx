"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import React, { useState, useRef, useEffect } from "react";

import { Button, Collapsible, CollapsibleTrigger } from "@repo/ui/components";

interface ExperimentDataTableArrayCellProps {
  data: string; // JSON string representation of the array
  columnName: string;
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
  columnName: _columnName,
}: ExperimentDataTableArrayCellProps) {
  const [isOpen, setIsOpen] = useState(false);
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
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="flex items-center gap-1">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
              {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </Button>
          </CollapsibleTrigger>
          <span className="muted-foreground text-sm">
            {itemCount} {itemCount === 1 ? "item" : "items"}
          </span>
        </div>

        {isOpen && <ArrayExpandedContent items={parsedData} cellRef={cellRef} />}
      </Collapsible>
    </div>
  );
}

interface ArrayExpandedContentProps {
  items: Record<string, unknown>[];
  cellRef: React.RefObject<HTMLDivElement | null>;
}

export function ArrayExpandedContent({ items, cellRef }: ArrayExpandedContentProps) {
  useEffect(() => {
    const cellElement = cellRef.current;
    if (!cellElement) return;

    // Find the table row that contains this cell
    const tableRow = cellElement.closest("tr");
    const table = cellElement.closest("table");

    if (!tableRow || !table) return;

    // Create the expanded row element
    const expandedRow = document.createElement("tr");
    expandedRow.className = "array-expanded-row";

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

    // Create the main container for array items
    const arrayDiv = document.createElement("div");
    arrayDiv.className = "space-y-4";

    // Add each item in the array
    items.forEach((item, index) => {
      const itemDiv = document.createElement("div");
      itemDiv.className = "border border-gray-200 dark:border-gray-600 rounded-lg p-3";

      // Add item header
      const headerDiv = document.createElement("div");
      headerDiv.className = "text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2";
      headerDiv.textContent = `Item ${index + 1}`;
      itemDiv.appendChild(headerDiv);

      // Create the grid container for item properties
      const gridDiv = document.createElement("div");
      gridDiv.className = "grid gap-2";

      // Add each property of the item
      Object.entries(item).forEach(([key, value]) => {
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

      itemDiv.appendChild(gridDiv);
      arrayDiv.appendChild(itemDiv);
    });

    contentDiv.appendChild(arrayDiv);
    expandedCell.appendChild(contentDiv);
    expandedRow.appendChild(expandedCell);

    // Insert the expanded row after the current row
    tableRow.parentNode?.insertBefore(expandedRow, tableRow.nextSibling);

    // Cleanup function to remove the expanded row
    return () => {
      expandedRow.remove();
    };
  }, [items, cellRef]);

  return null; // This component doesn't render anything directly
}
