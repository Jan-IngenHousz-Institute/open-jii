"use client";

import { HelpCircle } from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";

import type { QuestionCell, WorkbookCell } from "@repo/api/domains/workbook/workbook-cells.schema";
import {
  sanitizeQuestionLabel,
  stripSpecialCharacters,
} from "@repo/api/transforms/label-sanitization";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Popover, PopoverContent, PopoverTrigger } from "@repo/ui/components/popover";

interface QuestionPickerProps {
  existingCells: WorkbookCell[];
  onSelect: (cell: QuestionCell) => void;
  children: ReactNode;
}

// Question cells supply column keys for the data pipeline, so the name must
// be set at creation time and be unique within the workbook. This is the only
// path that creates question cells; createDefaultCell throws for that type.
export function QuestionPicker({ existingCells, onSelect, children }: QuestionPickerProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  const canonical = name ? sanitizeQuestionLabel(name) : "";

  const existingCanonicals = useMemo(() => {
    const set = new Set<string>();
    for (const cell of existingCells) {
      if (cell.type === "question") set.add(sanitizeQuestionLabel(cell.name));
    }
    return set;
  }, [existingCells]);

  const trimmed = name.trim();
  const isDuplicate = trimmed.length > 0 && existingCanonicals.has(canonical);
  const isValid = trimmed.length > 0 && !isDuplicate;

  const reset = () => {
    setOpen(false);
    setName("");
  };

  const handleCreate = () => {
    if (!isValid) return;
    const cell: QuestionCell = {
      id: crypto.randomUUID(),
      type: "question",
      isCollapsed: false,
      isAnswered: false,
      name: trimmed,
      question: { kind: "open_ended", text: "", required: false },
    };
    onSelect(cell);
    reset();
  };

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setName("");
      }}
    >
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-80 p-3" align="start" side="bottom">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <HelpCircle className="size-4 text-[#C58AAE]" />
            <p className="text-sm font-medium">Name your question</p>
          </div>
          <p className="text-muted-foreground text-xs">
            This name identifies the question column in exported data. It must be unique within the
            workbook.
          </p>
          <Input
            value={name}
            onChange={(e) => setName(stripSpecialCharacters(e.target.value))}
            placeholder="e.g. Soil moisture"
            className="h-8 text-sm"
            maxLength={64}
            aria-label="Question name"
            aria-invalid={isDuplicate}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter" && isValid) handleCreate();
            }}
          />
          {trimmed && (
            <p
              className={
                isDuplicate ? "text-destructive text-xs" : "text-muted-foreground font-mono text-xs"
              }
            >
              {isDuplicate
                ? `"${canonical}" is already used by another question cell`
                : `Column key: ${canonical}`}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={reset}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleCreate} disabled={!isValid}>
              Create
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
