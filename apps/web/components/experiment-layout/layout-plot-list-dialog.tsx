"use client";

import { useMetadataImport } from "@/components/experiment-data/metadata-upload-modal/use-metadata-import";
import { MetadataTable } from "@/components/metadata-table/metadata-table";
import type { MetadataColumn, MetadataRow } from "@/components/metadata-table/types";
import { ClipboardPaste, ListChecks, Upload } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import { Label } from "@repo/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";

import type { PlotListEntry, PlotListMapping } from "./plot-list-preview";
import { PlotListPreview } from "./plot-list-preview";
import { rowLetter } from "./row-letter";
import { UnitName } from "./unit-name";

interface LayoutPlotListDialogProps {
  levelName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const NONE = "__none__";
const NAMES_SHOWN = 5;

function guessColumn(columns: readonly MetadataColumn[], pattern: RegExp): string | null {
  return columns.find((column) => pattern.test(column.name.trim()))?.id ?? null;
}

/**
 * Paste a plot list: the metadata importer, read as one plot per row with its name and, where the
 * sheet has them, its row and column. Rows without a position become unplaced plots.
 */
export function LayoutPlotListDialog({ levelName, open, onOpenChange }: LayoutPlotListDialogProps) {
  const { t } = useTranslation("experiments");
  const unitName = new UnitName(levelName);
  const [columns, setColumns] = useState<MetadataColumn[]>([]);
  const [rows, setRows] = useState<MetadataRow[]>([]);
  const form = useForm<PlotListMapping>({
    defaultValues: { plotColumnId: "", rowColumnId: null, columnColumnId: null },
  });
  const mapping = form.watch();

  const importData = ({
    columns: imported,
    rows: importedRows,
  }: {
    columns: MetadataColumn[];
    rows: MetadataRow[];
  }) => {
    setColumns(imported);
    setRows(importedRows);
    form.reset({
      plotColumnId:
        guessColumn(imported, /^(plot|name|plot name|id)$/i) ?? imported.at(0)?.id ?? "",
      rowColumnId: guessColumn(imported, /^row$/i),
      columnColumnId: guessColumn(imported, /^(column|col)$/i),
    });
  };

  const { fileInputRef, importError, isPasting, handleFileSelect, handlePaste } = useMetadataImport(
    {
      enabled: open && columns.length === 0,
      onImported: importData,
    },
  );

  const hasData = columns.length > 0;
  const preview =
    hasData && mapping.plotColumnId !== "" ? new PlotListPreview(rows, mapping) : null;

  const updateCell = (rowId: string, columnId: string, value: string | number | null) => {
    setRows(rows.map((row) => (row._id === rowId ? { ...row, [columnId]: value } : row)));
  };

  const deleteRow = (rowId: string) => {
    setRows(rows.filter((row) => row._id !== rowId));
  };

  const deleteColumn = (columnId: string) => {
    setColumns(columns.filter((column) => column.id !== columnId));
  };

  const renameColumn = (columnId: string, name: string) => {
    setColumns(columns.map((column) => (column.id === columnId ? { ...column, name } : column)));
  };

  const setPlotColumn = (columnId: string | null) => {
    form.setValue("plotColumnId", columnId ?? "");
  };

  const close = () => {
    onOpenChange(false);
  };

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  const pasteFromClipboard = () => {
    void handlePaste();
  };

  const listNames = (names: readonly string[]) => {
    const shown = names.slice(0, NAMES_SHOWN).join(", ");
    const hidden = names.length - NAMES_SHOWN;
    return hidden > 0 ? t("layout.sheetMatch.moreNames", { names: shown, count: hidden }) : shown;
  };

  const clashName = ({ identifier, clash }: PlotListEntry) =>
    clash === undefined
      ? identifier
      : t("layout.plotList.clashName", {
          plot: identifier,
          row: rowLetter(clash.row),
          column: clash.column,
          keptBy: clash.keptBy,
        });

  const renderColumnOption = (column: MetadataColumn) => (
    <SelectItem key={column.id} value={column.id}>
      {column.name}
    </SelectItem>
  );

  const renderMappingSelect = (name: keyof PlotListMapping, label: string, isOptional: boolean) => {
    const value = mapping[name] ?? NONE;
    const handleChange = (next: string) => {
      form.setValue(name, next === NONE ? (isOptional ? null : "") : next);
    };
    return (
      <div className="grid gap-1.5">
        <Label htmlFor={`plot-list-${name}`}>{label}</Label>
        <Select value={value} onValueChange={handleChange}>
          <SelectTrigger id={`plot-list-${name}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {columns.map(renderColumnOption)}
            {isOptional ? (
              <SelectItem value={NONE}>{t("layout.plotList.noColumn")}</SelectItem>
            ) : null}
          </SelectContent>
        </Select>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-175">
        <DialogHeader>
          <DialogTitle>{t("layout.plotList.title")}</DialogTitle>
          <DialogDescription>{t("layout.plotList.description")}</DialogDescription>
        </DialogHeader>

        <DialogBody className="min-w-0 space-y-4">
          {hasData ? (
            <>
              <div className="grid grid-cols-3 gap-3" data-plot-list-mapping>
                {renderMappingSelect("plotColumnId", t("layout.plotList.plotColumn"), false)}
                {renderMappingSelect("rowColumnId", t("layout.plotList.rowColumn"), true)}
                {renderMappingSelect("columnColumnId", t("layout.plotList.columnColumn"), true)}
              </div>
              <div className="overflow-x-auto">
                <MetadataTable
                  columns={columns}
                  rows={rows}
                  identifierColumnId={mapping.plotColumnId || null}
                  onUpdateCell={updateCell}
                  onDeleteRow={deleteRow}
                  onDeleteColumn={deleteColumn}
                  onRenameColumn={renameColumn}
                  onSetIdentifierColumn={setPlotColumn}
                  pageSize={5}
                />
              </div>
              {preview ? (
                <div
                  className="bg-muted/40 flex gap-2 rounded-md border px-3 py-2 text-sm"
                  data-plot-list-preview
                >
                  <ListChecks
                    className="text-muted-foreground mt-0.5 size-4 shrink-0"
                    aria-hidden
                  />
                  <div className="space-y-1">
                    <p>
                      {t("layout.plotList.placed", {
                        ...unitName.forCount(preview.placed.length),
                        rows: preview.size.rows,
                        columns: preview.size.columns,
                        gaps: preview.gapCount,
                      })}
                    </p>
                    {preview.withoutPosition.length > 0 ? (
                      <p>
                        {t("layout.plotList.unplaced", {
                          count: preview.withoutPosition.length,
                          names: listNames(preview.withoutPosition.map((plot) => plot.identifier)),
                        })}
                      </p>
                    ) : null}
                    {preview.clashing.length > 0 ? (
                      <p>
                        {t("layout.plotList.clash", {
                          count: preview.clashing.length,
                          names: listNames(preview.clashing.map(clashName)),
                        })}
                      </p>
                    ) : null}
                    {preview.duplicateNames.length > 0 ? (
                      <p className="text-muted-foreground">
                        {t("layout.sheetMatch.duplicates", {
                          names: listNames(preview.duplicateNames),
                        })}
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <div className="flex flex-col items-center gap-4 rounded-lg border-2 border-dashed p-8 text-center">
              <p className="font-medium">{t("layout.plotList.prompt")}</p>
              <div className="flex gap-3">
                <Button type="button" variant="outline" onClick={openFilePicker}>
                  <Upload className="size-4" aria-hidden />
                  {t("uploadModal.metadata.uploadFile")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={pasteFromClipboard}
                  disabled={isPasting}
                >
                  <ClipboardPaste className="size-4" aria-hidden />
                  {t("uploadModal.metadata.pasteClipboard")}
                </Button>
              </div>
            </div>
          )}
          {importError ? <p className="text-destructive text-sm">{importError}</p> : null}
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.tsv,.txt,.xlsx,.xls"
            onChange={handleFileSelect}
            className="hidden"
          />
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={close}>
            {t("layout.setup.cancel")}
          </Button>
          <Button
            type="button"
            disabled={preview === null || preview.plots.length === 0}
            onClick={close}
          >
            {t("layout.setup.create", unitName.forCount(preview?.plots.length ?? 0))}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
