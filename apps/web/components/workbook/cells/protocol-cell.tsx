"use client";

import { AutosaveIndicator } from "@/components/shared/autosave/autosave-indicator";
import { useProtocol } from "@/hooks/protocol/useProtocol/useProtocol";
import { useProtocolUpdate } from "@/hooks/protocol/useProtocolUpdate/useProtocolUpdate";
import { useAutosave } from "@/hooks/useAutosave";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { registerProtocolCodeSource } from "@/lib/protocol-code-registry";
import { getSensorFamilyLabel } from "@/util/sensor-family";
import { ArrowUpCircle, Check, Copy, ExternalLink, Loader2, Microscope } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { parseApiError } from "~/util/apiError";

import type { ProtocolCell as ProtocolCellType } from "@repo/api/schemas/workbook-cells.schema";
import { useSession } from "@repo/auth/client";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { toast } from "@repo/ui/hooks/use-toast";

import { CellWrapper } from "../cell-wrapper";
import { EntityVersionHistory } from "../entity-version-history";
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
  const version = cell.payload.version;
  const { copy, copied } = useCopyToClipboard();
  const { data: session } = useSession();

  // One call returns the PINNED version's code plus head metadata (name/family/owner/latest).
  const { data: protocolData, isLoading: protocolLoading } = useProtocol(protocolId, true, version);

  const protocolName = protocolData?.body.name;
  const latestVersion = protocolData?.body.latestVersion;
  const protocolCode = protocolData?.body.code
    ? JSON.stringify(protocolData.body.code, null, 2)
    : null;

  const protocolFamily = protocolData?.body.family;
  const isOwner = !!session?.user.id && session.user.id === protocolData?.body.createdBy;
  const isEditable = isOwner && !readOnly;
  // Re-pinning a cell to a newer version is a workbook edit, available to any workbook
  // editor — not just the protocol's owner.
  const hasUpgrade = !readOnly && latestVersion != null && latestVersion > version;

  const { mutateAsync: saveProtocol } = useProtocolUpdate(protocolId);

  const [localCode, setLocalCode] = useState<string | null>(null);

  useEffect(() => {
    if (protocolCode != null && localCode == null) {
      setLocalCode(protocolCode);
    }
  }, [protocolCode, localCode]);

  // Editing mints a new protocol version server-side; re-pin THIS cell to it so other
  // workbooks stay on their version. localCode already holds the code, so no flicker.
  const save = useCallback(
    async (code: string) => {
      try {
        const res = await saveProtocol({
          params: { id: protocolId },
          body: { code: JSON.parse(code) as Record<string, unknown>[] },
        });
        onUpdate({ ...cell, payload: { ...cell.payload, version: res.body.latestVersion } });
      } catch (err) {
        toast({ description: parseApiError(err)?.message, variant: "destructive" });
        throw err;
      }
    },
    [protocolId, saveProtocol, cell, onUpdate],
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

  const handleUpgrade = useCallback(() => {
    if (latestVersion == null) return;
    setLocalCode(null);
    onUpdate({ ...cell, payload: { ...cell.payload, version: latestVersion } });
  }, [cell, onUpdate, latestVersion]);

  const handleRestore = useCallback(() => {
    setLocalCode(null);
  }, []);

  const handleDuplicated = useCallback(
    (entity: { id: string; name: string }) => {
      setLocalCode(null);
      onUpdate({
        ...cell,
        payload: { ...cell.payload, protocolId: entity.id, version: 1, name: entity.name },
      });
    },
    [cell, onUpdate],
  );

  // Expose the live editor code to the run flow so the device runs exactly what is on
  // screen — no backend round-trip — while autosave persists in the background.
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
  const isLoading = protocolLoading;

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
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className="text-[10px]">
            v{version}
          </Badge>
          {hasUpgrade ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 gap-1 px-1.5 text-[10px] font-medium text-[#005E5E] hover:text-[#005E5E]"
              onClick={handleUpgrade}
              title={`A newer version is available — update this cell to v${latestVersion}`}
            >
              <ArrowUpCircle className="h-3 w-3" />v{latestVersion}
            </Button>
          ) : null}
          {protocolFamily ? (
            <span className="text-xs capitalize text-[#68737B]">
              {getSensorFamilyLabel(protocolFamily)}
            </span>
          ) : null}
          {isEditable && localCode != null ? (
            <AutosaveIndicator status={autosave.status} variant="compact" />
          ) : null}
        </div>
      }
      headerActions={
        <div className="flex items-center gap-1">
          {isEditable ? (
            <EntityVersionHistory
              kind="protocol"
              entityId={protocolId}
              currentVersion={version}
              onRestored={handleRestore}
              onDuplicated={handleDuplicated}
            />
          ) : null}
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
      {isLoading ? (
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
