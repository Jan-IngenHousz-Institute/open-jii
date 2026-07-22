"use client";

import { DocsHelpLink } from "@/components/docs-help-link";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { Check, Copy, Terminal } from "lucide-react";
import { useMemo } from "react";

import type { CommandFormat } from "@repo/api/domains/experiment/experiment.schema";
import type { CommandCell as CommandCellType } from "@repo/api/domains/workbook/workbook-cells.schema";
import { validateInlineCommand } from "@repo/api/transforms/command-payload";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";

import { buildCommandExtensions } from "../../shared/command-completions";
import { CellWrapper } from "../cell-wrapper";
import { WorkbookCodeEditor } from "../workbook-code-editor";
import type { EditorLanguage } from "../workbook-code-editor";

const FORMAT_LABELS: Record<CommandFormat, string> = {
  string: "String",
  json: "JSON",
  yaml: "YAML",
};

const FORMAT_LANGUAGE: Record<CommandFormat, EditorLanguage> = {
  string: "text",
  json: "json",
  yaml: "yaml",
};

interface CommandCellProps {
  cell: CommandCellType;
  onUpdate: (cell: CommandCellType) => void;
  onDelete: () => void;
  onRun?: () => void;
  executionStatus?: "idle" | "running" | "completed" | "error";
  executionError?: string;
  readOnly?: boolean;
}

export function CommandCellComponent({
  cell,
  onUpdate,
  onDelete,
  onRun,
  executionStatus,
  executionError,
  readOnly,
}: CommandCellProps) {
  const { copy, copied } = useCopyToClipboard();
  const { t } = useTranslation("common");
  const { t: tWorkbook } = useTranslation("workbook");
  const { format, content } = cell.payload;

  const validation = useMemo(() => validateInlineCommand({ format, content }), [format, content]);

  // Known-command autocomplete + hover hints only apply to the free-text `string`
  // format; json/yaml payloads are structured, not a single command word.
  const commandExtensions = useMemo(
    () =>
      format === "string"
        ? buildCommandExtensions({
            singleLine: true,
            placeholder: t("experiments.commandPanelPlaceholder"),
            readOnly,
          })
        : undefined,
    [format, readOnly, t],
  );

  // A single-line command reads as an input, not a code block; drop the gutter.
  const commandBasicSetup = useMemo(
    () =>
      format === "string"
        ? {
            lineNumbers: false,
            foldGutter: false,
            highlightActiveLine: false,
            highlightActiveLineGutter: false,
          }
        : undefined,
    [format],
  );

  const update = (patch: Partial<CommandCellType["payload"]>) =>
    onUpdate({ ...cell, payload: { ...cell.payload, ...patch } });

  const nameOrContent = cell.payload.name?.trim() ? cell.payload.name : content;
  const displayName = nameOrContent.length > 0 ? nameOrContent : tWorkbook("cells.command");

  return (
    <CellWrapper
      icon={<Terminal className="h-3.5 w-3.5" />}
      label={displayName}
      accentColor="#119DA4"
      isCollapsed={cell.isCollapsed}
      onToggleCollapse={(collapsed) => onUpdate({ ...cell, isCollapsed: collapsed })}
      onDelete={onDelete}
      onRun={onRun}
      executionStatus={executionStatus}
      executionError={executionError}
      readOnly={readOnly}
      headerActions={
        <div className="flex items-center gap-1">
          <DocsHelpLink
            iconOnly
            path="/guide/devices-protocols/commands"
            className="h-7 w-7 justify-center"
          />
          {!readOnly ? (
            <Select value={format} onValueChange={(v) => update({ format: v as CommandFormat })}>
              <SelectTrigger className="h-7 w-[90px] text-xs" aria-label="Command format">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["string", "json", "yaml"] as const).map((f) => (
                  <SelectItem key={f} value={f} className="text-xs">
                    {FORMAT_LABELS[f]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <span className="text-xs uppercase text-[#68737B]">{FORMAT_LABELS[format]}</span>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground h-7 w-7 p-0"
            onClick={() => void copy(content)}
          >
            {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
          </Button>
        </div>
      }
    >
      <div className="space-y-2">
        <WorkbookCodeEditor
          value={content}
          onChange={readOnly ? undefined : (v) => update({ content: v })}
          language={FORMAT_LANGUAGE[format]}
          minHeight={format === "string" ? "44px" : readOnly ? "80px" : "120px"}
          maxHeight="400px"
          readOnly={readOnly}
          extraExtensions={commandExtensions}
          basicSetup={commandBasicSetup}
        />
        {!validation.ok ? <p className="text-xs text-red-500">{validation.error}</p> : null}
      </div>
    </CellWrapper>
  );
}
