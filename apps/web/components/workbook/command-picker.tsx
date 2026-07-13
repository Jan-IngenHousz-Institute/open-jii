"use client";

import { useCommandCreate } from "@/hooks/command/useCommandCreate/useCommandCreate";
import { useCommands } from "@/hooks/command/useCommands/useCommands";
import { SENSOR_FAMILY_OPTIONS } from "@/util/sensor-family";
import { Loader2, Microscope, Plus, Search } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

import type { SensorFamily } from "@repo/api/schemas/command.schema";
import type { CommandCell } from "@repo/api/schemas/workbook-cells.schema";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Popover, PopoverContent, PopoverTrigger } from "@repo/ui/components/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";

const isDisabledFamily = (family: SensorFamily) =>
  SENSOR_FAMILY_OPTIONS.find((o) => o.value === family)?.disabled ?? false;

interface CommandPickerProps {
  sensorFamily?: SensorFamily;
  onSelect: (cell: CommandCell) => void;
  children: ReactNode;
}

export function CommandPicker({
  sensorFamily = "multispeq",
  onSelect,
  children,
}: CommandPickerProps) {
  const [open, setOpen] = useState(false);
  // Drive search from the hook's own state so the input actually filters the
  // query (passing it as `initialSearch` is read only once).
  const { commands, search, setSearch } = useCommands({ initialFilter: "all" });

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  // Commands can only be created for a locally-runnable family; an ingest-only
  // (disabled) sensorFamily falls back to the default creatable one.
  const creatableFamily: SensorFamily = isDisabledFamily(sensorFamily) ? "multispeq" : sensorFamily;
  const [newFamily, setNewFamily] = useState<SensorFamily>(creatableFamily);
  const [isCreating, setIsCreating] = useState(false);
  const createCommand = useCommandCreate();

  const handleSelect = (command: { id: string; name: string; family: string }) => {
    const cell: CommandCell = {
      id: crypto.randomUUID(),
      type: "command",
      isCollapsed: false,
      payload: {
        commandId: command.id,
        version: 1,
        name: command.name,
      },
    };
    onSelect(cell);
    resetAndClose();
  };

  const handleCreate = async () => {
    if (!newName.trim() || isDisabledFamily(newFamily)) return;
    setIsCreating(true);
    try {
      const result = await createCommand.mutateAsync({
        body: {
          name: newName.trim(),
          family: newFamily,
          code: [],
        },
      });
      const cell: CommandCell = {
        id: crypto.randomUUID(),
        type: "command",
        isCollapsed: false,
        payload: {
          commandId: result.body.id,
          version: 1,
          name: newName.trim(),
        },
      };
      onSelect(cell);
      resetAndClose();
    } catch {
      // Hook handles error toasts
    } finally {
      setIsCreating(false);
    }
  };

  const resetAndClose = () => {
    setOpen(false);
    setSearch("");
    setShowCreate(false);
    setNewName("");
    setNewFamily(creatableFamily);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) resetAndClose();
      }}
    >
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-80 p-3" align="start" side="bottom">
        <div className="space-y-3">
          {showCreate ? (
            <>
              <p className="text-sm font-medium">Create new command</p>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Command name"
                className="h-8 text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleCreate();
                }}
                autoFocus
              />
              <Select value={newFamily} onValueChange={(v) => setNewFamily(v as SensorFamily)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SENSOR_FAMILY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} disabled={opt.disabled}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowCreate(false)}>
                  Back
                </Button>
                <Button
                  size="sm"
                  onClick={() => void handleCreate()}
                  disabled={!newName.trim() || isCreating}
                >
                  {isCreating && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
                  Create
                </Button>
              </div>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                className="w-full justify-start gap-2 text-sm"
                onClick={() => setShowCreate(true)}
              >
                <Plus className="h-4 w-4 text-[#2D3142]" />
                Create new command
              </Button>

              <div className="relative">
                <Search className="text-muted-foreground absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search commands..."
                  className="h-8 pl-8 text-sm"
                />
              </div>

              <div className="max-h-[240px] space-y-0.5 overflow-y-auto">
                {commands && commands.length > 0 ? (
                  commands.map((p) => (
                    <button
                      type="button"
                      key={p.id}
                      className="hover:bg-accent flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors"
                      onClick={() => handleSelect(p)}
                    >
                      <Microscope className="h-3.5 w-3.5 shrink-0 text-[#2D3142]" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm">{p.name}</p>
                        {p.createdByName && (
                          <p className="text-muted-foreground truncate text-xs">
                            by {p.createdByName}
                          </p>
                        )}
                      </div>
                      <Badge variant="outline" className="shrink-0 text-[10px]">
                        {p.family}
                      </Badge>
                    </button>
                  ))
                ) : (
                  <p className="text-muted-foreground py-3 text-center text-xs">
                    {search ? "No commands found" : "No commands available"}
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
