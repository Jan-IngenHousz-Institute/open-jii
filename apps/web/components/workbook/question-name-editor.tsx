"use client";

import { HelpCircle } from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";

import { sanitizeQuestionLabel } from "@repo/api/schemas/experiment.schema";
import type { WorkbookCell } from "@repo/api/schemas/workbook-cells.schema";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Popover, PopoverContent, PopoverTrigger } from "@repo/ui/components/popover";

interface QuestionNameEditorProps {
  initialName: string;
  cellId: string;
  existingCells: WorkbookCell[];
  onRename: (newName: string) => void;
  children: ReactNode;
}

export function QuestionNameEditor({
  initialName,
  cellId,
  existingCells,
  onRename,
  children,
}: QuestionNameEditorProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(initialName);

  const trimmed = name.trim();
  const canonical = trimmed ? sanitizeQuestionLabel(trimmed) : "";

  const otherCanonicals = useMemo(() => {
    const set = new Set<string>();
    for (const cell of existingCells) {
      if (cell.type !== "question" || cell.id === cellId) continue;
      set.add(sanitizeQuestionLabel(cell.name));
    }
    return set;
  }, [existingCells, cellId]);

  const isDuplicate = trimmed.length > 0 && otherCanonicals.has(canonical);
  const isUnchanged = trimmed === initialName.trim();
  const isValid = trimmed.length > 0 && !isDuplicate;

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) setName(initialName);
  };

  const handleSubmit = () => {
    if (!isValid) return;
    if (!isUnchanged) onRename(trimmed);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-80 p-3" align="start" side="bottom">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <HelpCircle className="size-4 text-[#C58AAE]" />
            <p className="text-sm font-medium">Rename question</p>
          </div>
          <p className="text-muted-foreground text-xs">
            This name identifies the question column in exported data. It must be unique within the
            workbook.
          </p>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Soil moisture"
            className="h-8 text-sm"
            maxLength={64}
            aria-label="Question name"
            aria-invalid={isDuplicate}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter" && isValid) handleSubmit();
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
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSubmit} disabled={!isValid}>
              Save
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
