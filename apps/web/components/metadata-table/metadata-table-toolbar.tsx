"use client";

import { useRef } from "react";
import { useMetadata } from "./metadata-context";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components";
import { ClipboardPaste, Download, KeyRound, Plus, Save, Upload } from "lucide-react";

interface MetadataTableToolbarProps {
  disabled?: boolean;
}

export function MetadataTableToolbar({ disabled = false }: MetadataTableToolbarProps) {
  const {
    state,
    addRow,
    addColumn,
    importFromClipboard,
    importFromFile,
    save,
    isSaving,
  } = useMetadata();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasIdentifier = state.identifierColumnId != null;

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await importFromFile(file);
    }
    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={disabled}>
            <Upload className="mr-2 h-4 w-4" />
            Import
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
            <Upload className="mr-2 h-4 w-4" />
            Upload CSV/Excel
          </DropdownMenuItem>
          <DropdownMenuItem onClick={importFromClipboard}>
            <ClipboardPaste className="mr-2 h-4 w-4" />
            Paste from clipboard
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.tsv,.txt,.xlsx,.xls"
        onChange={handleFileSelect}
        className="hidden"
      />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={disabled}>
            <Plus className="mr-2 h-4 w-4" />
            Add
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={addRow}>Add row</DropdownMenuItem>
          <DropdownMenuItem onClick={() => addColumn({ name: "New Column", type: "string" })}>
            Add column
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {state.isDirty && (
        <div className="flex items-center gap-2">
          {!hasIdentifier && (
            <span className="flex items-center gap-1 text-xs text-amber-600">
              <KeyRound className="h-3 w-3" />
              Select an identifier column to save
            </span>
          )}
          <Button
            variant="default"
            size="sm"
            onClick={save}
            disabled={isSaving || disabled || !hasIdentifier}
            title={!hasIdentifier ? "Please select an identifier column first" : undefined}
          >
            <Save className="mr-2 h-4 w-4" />
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </div>
      )}
    </div>
  );
}
