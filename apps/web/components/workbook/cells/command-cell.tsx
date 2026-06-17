"use client";

import { Check, ChevronsUpDown, Terminal } from "lucide-react";
import { useMemo, useState } from "react";

import type { DeviceCommand, DeviceCommandOption } from "@repo/api/schemas/device-command.schema";
import { KNOWN_DEVICE_COMMANDS } from "@repo/api/schemas/device-command.schema";
import type { CommandCell as CommandCellType } from "@repo/api/schemas/workbook-cells.schema";
import { Button } from "@repo/ui/components/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@repo/ui/components/command";
import { Popover, PopoverContent, PopoverTrigger } from "@repo/ui/components/popover";
import { cn } from "@repo/ui/lib/utils";

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

/** Known device commands grouped by their `group`, preserving declaration order. */
function groupedCommands(): { group: string; options: DeviceCommandOption[] }[] {
  const groups: { group: string; options: DeviceCommandOption[] }[] = [];
  for (const option of COMMANDS) {
    let bucket = groups.find((g) => g.group === option.group);
    if (!bucket) {
      bucket = { group: option.group, options: [] };
      groups.push(bucket);
    }
    bucket.options.push(option);
  }
  return groups;
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
  const [open, setOpen] = useState(false);
  const groups = useMemo(groupedCommands, []);

  const command = cell.payload.command;
  const selected = commandOption(command);
  const displayName = cell.payload.name ?? selected?.label ?? "Command";

  const handleSelect = (value: DeviceCommand) => {
    setOpen(false);
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
            {selected?.description ? (
              <span className="text-muted-foreground text-xs">{selected.description}</span>
            ) : null}
          </div>
        ) : (
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={open}
                aria-label="Select a command"
                className="w-full max-w-md justify-between font-mono"
              >
                {command}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-[--radix-popover-trigger-width] max-w-md p-0"
              align="start"
            >
              <Command>
                <CommandInput placeholder="Search commands…" />
                <CommandList>
                  <CommandEmpty>No command found.</CommandEmpty>
                  {groups.map(({ group, options }) => (
                    <CommandGroup key={group} heading={group}>
                      {options.map((option) => (
                        <CommandItem
                          key={option.value}
                          value={`${option.value} ${option.label}`}
                          onSelect={() => handleSelect(option.value as DeviceCommand)}
                        >
                          <Check
                            className={cn(
                              "h-4 w-4",
                              option.value === command ? "opacity-100" : "opacity-0",
                            )}
                            style={{ color: ACCENT }}
                          />
                          <span className="font-mono text-sm">{option.value}</span>
                          {option.description ? (
                            <span className="text-muted-foreground ml-auto truncate text-xs">
                              {option.description}
                            </span>
                          ) : null}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  ))}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </CellWrapper>
  );
}
