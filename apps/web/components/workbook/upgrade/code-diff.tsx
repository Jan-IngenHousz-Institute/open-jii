"use client";

import { lineDiff } from "@/lib/line-diff";
import { useMemo } from "react";

import { cn } from "@repo/ui/lib/utils";

interface CodeDiffProps {
  oldText: string;
  newText: string;
}

const linePrefix = { same: " ", add: "+", del: "-" } as const;

/** Compact red/green line diff of two text blocks. */
export function CodeDiff({ oldText, newText }: CodeDiffProps) {
  const lines = useMemo(() => lineDiff(oldText, newText), [oldText, newText]);

  return (
    <pre className="bg-muted max-h-64 overflow-auto rounded-md border p-2 text-[11px] leading-relaxed">
      {lines.map((line, i) => (
        <div
          key={i}
          className={cn(
            "whitespace-pre-wrap break-words px-1",
            line.type === "add" && "bg-status-active/40 text-status-active-foreground",
            line.type === "del" && "bg-destructive/10 text-destructive",
            line.type === "same" && "text-muted-foreground",
          )}
        >
          <span className="select-none opacity-60">{linePrefix[line.type]} </span>
          {line.text || " "}
        </div>
      ))}
    </pre>
  );
}
