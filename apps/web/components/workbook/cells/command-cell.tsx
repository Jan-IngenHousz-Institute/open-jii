"use client";

import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { Check, Copy, Terminal } from "lucide-react";
import { useMemo } from "react";

import type { CommandFormat } from "@repo/api/schemas/experiment.schema";
import type { CommandCell as CommandCellType } from "@repo/api/schemas/workbook-cells.schema";
import { validateInlineCommand } from "@repo/api/utils/command-payload";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";

import { CellWrapper } from "../cell-wrapper";
import { WorkbookCodeEditor } from "../workbook-code-editor";

const FORMAT_LABELS: Record<CommandFormat, string> = {
  string: "String",
  json: "JSON",
  yaml: "YAML",
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
  const { format, content } = cell.payload;

  const validation = useMemo(() => validateInlineCommand({ format, content }), [format, content]);

  const update = (patch: Partial<CommandCellType["payload"]>) =>
    onUpdate({ ...cell, payload: { ...cell.payload, ...patch } });

  const displayName = cell.payload.name ?? (content || "Command");

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
        {format === "string" ? (
          <Input
            value={content}
            onChange={(e) => update({ content: e.target.value })}
            placeholder="Type a command, e.g. battery"
            aria-label="Device command"
            className="font-mono text-sm"
            readOnly={readOnly}
          />
        ) : (
          <WorkbookCodeEditor
            value={content}
            onChange={readOnly ? undefined : (v) => update({ content: v })}
            language={format === "json" ? "json" : "yaml"}
            minHeight={readOnly ? "80px" : "120px"}
            maxHeight="400px"
            readOnly={readOnly}
          />
        )}
        {!validation.ok ? <p className="text-xs text-red-500">{validation.error}</p> : null}
      </div>
    </CellWrapper>
  );
}
