"use client";

import type {
  ColumnProducer,
  DictionaryColumn,
} from "@repo/api/domains/experiment/columns/experiment-columns.schema";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@repo/ui/components/sheet";

import { ColumnDescribeForm } from "./column-describe-form";
import { ColumnProducerLabel } from "./column-producer-label";

export interface SelectedColumn {
  column: DictionaryColumn;
  producer: ColumnProducer;
}

interface ColumnDescribeDrawerProps {
  experimentId: string;
  selected: SelectedColumn | null;
  onClose: () => void;
}

/** Records what one column measures: a trait, a method, a scale and a unit. */
export function ColumnDescribeDrawer({ experimentId, selected, onClose }: ColumnDescribeDrawerProps) {
  const isOpen = selected !== null;

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="sm:max-w-120 flex w-full flex-col gap-0 p-0">
        {selected && (
          <>
            <SheetHeader className="border-border border-b px-6 py-4">
              <SheetTitle className="font-mono">{selected.column.name}</SheetTitle>
              <SheetDescription>
                <ColumnProducerLabel producer={selected.producer} />
              </SheetDescription>
            </SheetHeader>
            <ColumnDescribeForm
              key={selected.column.identity}
              experimentId={experimentId}
              column={selected.column}
              onDone={onClose}
            />
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
