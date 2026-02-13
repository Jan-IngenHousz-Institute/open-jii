"use client";

import { useState } from "react";
import { useMetadata } from "./metadata-context";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components";

interface MergeConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  experimentColumns: { id: string; name: string }[];
  onConfirm: () => void;
}

export function MergeConfigDialog({
  open,
  onOpenChange,
  experimentColumns,
  onConfirm,
}: MergeConfigDialogProps) {
  const { state, mergeConfig, setMergeConfig } = useMetadata();
  const [metadataIdColumn, setMetadataIdColumn] = useState(mergeConfig?.identifierColumn ?? "");
  const [experimentIdColumn, setExperimentIdColumn] = useState(
    mergeConfig?.experimentIdentifierColumn ?? ""
  );

  const handleConfirm = () => {
    if (metadataIdColumn && experimentIdColumn) {
      setMergeConfig({
        identifierColumn: metadataIdColumn,
        experimentIdentifierColumn: experimentIdColumn,
      });
      onConfirm();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Configure Merge</DialogTitle>
          <DialogDescription>
            Select the identifier columns to match metadata with experiment data.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="metadata-column">Metadata identifier column</Label>
            <Select value={metadataIdColumn} onValueChange={setMetadataIdColumn}>
              <SelectTrigger id="metadata-column">
                <SelectValue placeholder="Select column" />
              </SelectTrigger>
              <SelectContent>
                {state.columns.map((col) => (
                  <SelectItem key={col.id} value={col.id}>
                    {col.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="experiment-column">Experiment identifier column</Label>
            <Select value={experimentIdColumn} onValueChange={setExperimentIdColumn}>
              <SelectTrigger id="experiment-column">
                <SelectValue placeholder="Select column (e.g., plot)" />
              </SelectTrigger>
              <SelectContent>
                {experimentColumns.map((col) => (
                  <SelectItem key={col.id} value={col.id}>
                    {col.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!metadataIdColumn || !experimentIdColumn}
          >
            Merge Data
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
