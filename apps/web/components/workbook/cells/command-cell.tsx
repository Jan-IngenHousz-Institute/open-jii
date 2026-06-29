"use client";

import { Terminal } from "lucide-react";

import type { DeviceCommandOption } from "@repo/api/schemas/device-command.schema";
import { KNOWN_DEVICE_COMMANDS } from "@repo/api/schemas/device-command.schema";
import type { CommandCell as CommandCellType } from "@repo/api/schemas/workbook-cells.schema";
import { useTranslation } from "@repo/i18n";

import { CommandEditor } from "../../shared/command-editor";
import { CELL_ACCENT } from "../cell-theme";
import { CellWrapper } from "../cell-wrapper";

const ACCENT = CELL_ACCENT.command;

interface CommandCellProps {
  cell: CommandCellType;
  onUpdate: (cell: CommandCellType) => void;
  onDelete: () => void;
  onRun?: () => void;
  executionStatus?: "idle" | "running" | "completed" | "error";
  executionError?: string;
  readOnly?: boolean;
}

const COMMANDS: readonly DeviceCommandOption[] = KNOWN_DEVICE_COMMANDS;

const commandOption = (value: string): DeviceCommandOption | undefined =>
  COMMANDS.find((c) => c.value === value);

export function CommandCellComponent({
  cell,
  onUpdate,
  onDelete,
  onRun,
  executionStatus,
  executionError,
  readOnly,
}: CommandCellProps) {
  const { t } = useTranslation("workbook");
  const command = cell.payload.command;
  const known = commandOption(command);
  const displayName = cell.payload.name ?? known?.label ?? command;

  const handleChange = (value: string) => {
    if (value === command) return;
    onUpdate({ ...cell, payload: { ...cell.payload, command: value } });
  };

  return (
    <CellWrapper
      icon={<Terminal className="h-3.5 w-3.5" />}
      label={displayName}
      accentColor={ACCENT}
      isCollapsed={cell.isCollapsed}
      onToggleCollapse={(collapsed) => onUpdate({ ...cell, isCollapsed: collapsed })}
      onDelete={onDelete}
      onRun={onRun}
      executionStatus={executionStatus}
      executionError={executionError}
      readOnly={readOnly}
    >
      <div className="py-2">
        {readOnly ? (
          <div className="flex flex-col gap-0.5">
            <code className="font-mono text-sm text-[#011111]">{command}</code>
            {known?.description ? (
              <span className="text-muted-foreground text-xs">{known.description}</span>
            ) : null}
          </div>
        ) : (
          <CommandEditor
            value={command}
            onChange={handleChange}
            aria-label={t("command.editorAriaLabel")}
            placeholder={t("command.editorPlaceholder")}
          />
        )}
      </div>
    </CellWrapper>
  );
}
