"use client";

import { useProtocolCreate } from "@/hooks/protocol/useProtocolCreate/useProtocolCreate";
import { useDebounce } from "@/hooks/useDebounce";
import { orpc } from "@/lib/orpc";
import { SENSOR_FAMILY_OPTIONS } from "@/util/sensor-family";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Microscope, Plus, Search } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

import type { ProtocolFamily, SensorFamily } from "@repo/api/domains/protocol/protocol.schema";
import { zProtocolFamily } from "@repo/api/domains/protocol/protocol.schema";
import type { ProtocolCell } from "@repo/api/domains/workbook/workbook-cells.schema";
import { listItems } from "@repo/api/shared/listing";
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

interface ProtocolPickerProps {
  sensorFamily?: SensorFamily;
  onSelect: (cell: ProtocolCell) => void;
  children: ReactNode;
}

export function ProtocolPicker({
  sensorFamily = "multispeq",
  onSelect,
  children,
}: ProtocolPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebounce(search, 300);
  const {
    data: protocolsData,
    isPending: isProtocolsPending,
    isError: isProtocolsError,
    refetch: refetchProtocols,
  } = useQuery(
    orpc.protocols.listProtocols.queryOptions({
      input: { search: debouncedSearch.trim() || undefined },
    }),
  );
  // No `page` is sent, so the response is the bare list.
  const protocols = protocolsData ? listItems(protocolsData) : undefined;

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  // Protocols can only be created for a locally-runnable family; an ingest-only
  // (disabled) sensorFamily falls back to the default creatable one.
  const creatableFamily: ProtocolFamily = isDisabledFamily(sensorFamily)
    ? "multispeq"
    : zProtocolFamily.parse(sensorFamily);
  const [newFamily, setNewFamily] = useState<ProtocolFamily>(creatableFamily);
  const [isCreating, setIsCreating] = useState(false);
  const createProtocol = useProtocolCreate();

  const handleSelect = (protocol: { id: string; name: string; family: string }) => {
    const cell: ProtocolCell = {
      id: crypto.randomUUID(),
      type: "protocol",
      isCollapsed: false,
      payload: {
        protocolId: protocol.id,
        version: 1,
        name: protocol.name,
      },
    };
    onSelect(cell);
    resetAndClose();
  };

  const handleCreate = async () => {
    if (!newName.trim() || isDisabledFamily(newFamily)) return;
    setIsCreating(true);
    try {
      const result = await createProtocol.mutateAsync({
        name: newName.trim(),
        family: newFamily,
        code: [],
      });
      const cell: ProtocolCell = {
        id: crypto.randomUUID(),
        type: "protocol",
        isCollapsed: false,
        payload: {
          protocolId: result.id,
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
              <p className="text-sm font-medium">Create new protocol</p>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Protocol name"
                className="h-8 text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleCreate();
                }}
                autoFocus
              />
              <Select
                value={newFamily}
                onValueChange={(v) => setNewFamily(zProtocolFamily.parse(v))}
              >
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
                  {isCreating ? (
                    <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                  ) : (
                    <Plus className="size-3.5" aria-hidden />
                  )}
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
                <Plus className="text-node-measurement h-4 w-4" />
                Create new protocol
              </Button>

              <div className="relative">
                <Search className="text-muted-foreground absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search protocols..."
                  className="h-8 pl-8 text-sm"
                />
              </div>

              <div className="max-h-[240px] space-y-0.5 overflow-y-auto">
                {isProtocolsPending ? (
                  <div
                    role="status"
                    className="text-muted-foreground flex items-center justify-center gap-2 py-3 text-xs"
                  >
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Loading protocols...
                  </div>
                ) : isProtocolsError ? (
                  <div role="alert" className="space-y-2 py-3 text-center text-xs">
                    <p className="text-muted-foreground">Unable to load protocols.</p>
                    <Button variant="outline" size="sm" onClick={() => void refetchProtocols()}>
                      Try again
                    </Button>
                  </div>
                ) : protocols && protocols.length > 0 ? (
                  protocols.map((p) => (
                    <Button
                      type="button"
                      key={p.id}
                      variant="ghost"
                      className="h-auto w-full justify-start gap-2 px-2 py-1.5 text-left font-normal"
                      onClick={() => handleSelect(p)}
                    >
                      <Microscope className="text-node-measurement h-3.5 w-3.5 shrink-0" />
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
                    </Button>
                  ))
                ) : (
                  <p className="text-muted-foreground py-3 text-center text-xs">
                    {search ? "No protocols found" : "No protocols available"}
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
