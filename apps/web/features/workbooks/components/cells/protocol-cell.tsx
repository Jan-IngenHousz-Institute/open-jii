"use client";

import { registerProtocolCodeSource } from "@/features/protocols/domain/protocol-code-registry";
import { useProtocol } from "@/features/protocols/hooks/useProtocol/useProtocol";
import { useProtocolUpdate } from "@/features/protocols/hooks/useProtocolUpdate/useProtocolUpdate";
import { parseApiError } from "@/shared/api/apiError";
import { useAutosave } from "@/shared/hooks/useAutosave";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";
import { AutosaveIndicator } from "@/shared/ui/autosave/autosave-indicator";
import { getSensorFamilyLabel } from "@/shared/utils/sensor-family";
import { Check, Copy, ExternalLink, Loader2, Microscope } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import type { ProtocolCell as ProtocolCellType } from "@repo/api/schemas/workbook-cells.schema";
import { useSession } from "@repo/auth/client";
import { Button } from "@repo/ui/components/button";
import { toast } from "@repo/ui/hooks/use-toast";

import { CellWrapper } from "../cell-wrapper";
import { WorkbookCodeEditor } from "../workbook-code-editor";

interface ProtocolCellProps {
  cell: ProtocolCellType;
  onUpdate: (cell: ProtocolCellType) => void;
  onDelete: () => void;
  onRun?: () => void;
  executionStatus?: "idle" | "running" | "completed" | "error";
  executionError?: string;
  readOnly?: boolean;
}

export function ProtocolCellComponent({
  cell,
  onUpdate,
  onDelete,
  onRun,
  executionStatus,
  executionError,
  readOnly,
}: ProtocolCellProps) {
  const protocolId = cell.payload.protocolId;
  const { copy, copied } = useCopyToClipboard();
  const { data: session } = useSession();

  const { data: protocolData, isLoading: protocolLoading } = useProtocol(protocolId, true);
  const protocolName = protocolData?.body.name;
  // Newly-created protocols have an empty code array; render that as "[]" so owners can fill it in
  // rather than treating it as a load failure.
  const protocolCode = protocolData?.body.code
    ? JSON.stringify(protocolData.body.code, null, 2)
    : null;

  const protocolFamily = protocolData?.body.family;
  const isOwner = !!session?.user.id && session.user.id === protocolData?.body.createdBy;
  const isEditable = isOwner && !readOnly;

  const { mutateAsync: saveProtocol } = useProtocolUpdate(protocolId);

  const [localCode, setLocalCode] = useState<string | null>(null);

  useEffect(() => {
    if (protocolCode != null && localCode == null) {
      setLocalCode(protocolCode);
    }
  }, [protocolCode, localCode]);

  // Mirror the standalone protocol/macro editors: persist via the shared
  // `useAutosave` hook so debounce, status and flush behave identically across
  // all three editors. Protocol code is a JSON array; `isValid` skips saves
  // while the editor is mid-keystroke with text that does not yet parse.
  const save = useCallback(
    async (code: string) => {
      try {
        await saveProtocol({
          params: { id: protocolId },
          body: { code: JSON.parse(code) as Record<string, unknown>[] },
        });
      } catch (err) {
        toast({ description: parseApiError(err)?.message, variant: "destructive" });
        throw err;
      }
    },
    [protocolId, saveProtocol],
  );

  const isValidCode = useCallback((code: string) => {
    try {
      return Array.isArray(JSON.parse(code));
    } catch {
      return false;
    }
  }, []);

  const autosave = useAutosave<string>({
    value: localCode ?? "",
    toKey: (code) => code,
    isValid: isValidCode,
    save,
    enabled: isEditable && localCode != null,
  });

  // Expose the live editor code to the run flow so the device runs exactly what
  // is on screen — no backend round-trip — while autosave persists in the
  // background. Reads a ref so the source stays stable across keystrokes.
  const localCodeRef = useRef(localCode);
  localCodeRef.current = localCode;
  const getCurrentCode = useCallback((): Record<string, unknown>[] | null => {
    const code = localCodeRef.current;
    if (code == null) return null;
    try {
      const parsed: unknown = JSON.parse(code);
      return Array.isArray(parsed) ? (parsed as Record<string, unknown>[]) : null;
    } catch {
      return null;
    }
  }, []);
  useEffect(
    () => registerProtocolCodeSource(protocolId, getCurrentCode),
    [protocolId, getCurrentCode],
  );

  const handleCopy = () => {
    void copy(localCode ?? protocolCode ?? "");
  };

  const displayName = cell.payload.name ?? protocolName ?? "Protocol";

  return (
    <CellWrapper
      icon={<Microscope className="h-3.5 w-3.5" />}
      label={displayName}
      accentColor="#2D3142"
      isCollapsed={cell.isCollapsed}
      onToggleCollapse={(collapsed) => onUpdate({ ...cell, isCollapsed: collapsed })}
      onDelete={onDelete}
      onRun={onRun}
      executionStatus={executionStatus}
      executionError={executionError}
      readOnly={readOnly}
      headerBadges={
        protocolFamily || (isEditable && localCode != null) ? (
          <div className="flex items-center gap-2">
            {protocolFamily ? (
              <span className="text-xs capitalize text-[#68737B]">
                {getSensorFamilyLabel(protocolFamily)}
              </span>
            ) : null}
            {isEditable && localCode != null ? (
              <AutosaveIndicator status={autosave.status} variant="compact" />
            ) : null}
          </div>
        ) : undefined
      }
      headerActions={
        <div className="flex items-center gap-1">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="text-muted-foreground h-7 w-7 p-0 hover:text-[#005E5E]"
            title="Open protocol in new tab"
          >
            <Link
              href={`/platform/protocols/${protocolId}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open protocol in new tab"
            >
              <ExternalLink className="h-3 w-3" />
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground h-7 w-7 p-0"
            onClick={handleCopy}
          >
            {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
          </Button>
        </div>
      }
    >
      {protocolLoading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
        </div>
      ) : localCode != null || protocolCode != null ? (
        <WorkbookCodeEditor
          value={localCode ?? protocolCode ?? ""}
          onChange={isEditable ? setLocalCode : undefined}
          language="json"
          minHeight={isEditable ? "120px" : "80px"}
          maxHeight={isEditable ? "500px" : "400px"}
          readOnly={readOnly ?? !isOwner}
        />
      ) : (
        <p className="text-muted-foreground px-3 py-4 text-xs">Could not load protocol code</p>
      )}
    </CellWrapper>
  );
}
