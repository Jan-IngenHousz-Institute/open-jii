"use client";

import { useProtocol } from "@/hooks/protocol/useProtocol/useProtocol";
import { useProtocolUpdate } from "@/hooks/protocol/useProtocolUpdate/useProtocolUpdate";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { getSensorFamilyLabel } from "@/util/sensor-family";
import { Check, Copy, ExternalLink, Loader2, Microscope } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import type { ProtocolCell as ProtocolCellType } from "@repo/api/schemas/workbook-cells.schema";
import { useSession } from "@repo/auth/client";
import { Button } from "@repo/ui/components/button";

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

  const { mutate: saveProtocol } = useProtocolUpdate(protocolId);

  const [localCode, setLocalCode] = useState<string | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedKeyRef = useRef<string>("");

  useEffect(() => {
    if (protocolCode != null && localCode == null) {
      setLocalCode(protocolCode);
      savedKeyRef.current = protocolCode;
    }
  }, [protocolCode, localCode]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  const handleCodeChange = useCallback(
    (code: string) => {
      setLocalCode(code);

      if (code === savedKeyRef.current) return;

      // Protocol code is a JSON array; only persist when the editor contents parse successfully.
      let parsed: unknown;
      try {
        parsed = JSON.parse(code);
      } catch {
        return;
      }
      if (!Array.isArray(parsed)) return;

      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        saveProtocol(
          {
            params: { id: protocolId },
            body: { code: parsed as Record<string, unknown>[] },
          },
          {
            onSuccess: () => {
              savedKeyRef.current = code;
            },
          },
        );
      }, 1000);
    },
    [protocolId, saveProtocol],
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
        protocolFamily ? (
          <span className="text-xs capitalize text-[#68737B]">
            {getSensorFamilyLabel(protocolFamily)}
          </span>
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
          onChange={isOwner && !readOnly ? handleCodeChange : undefined}
          language="json"
          minHeight={isOwner && !readOnly ? "120px" : "80px"}
          maxHeight={isOwner && !readOnly ? "500px" : "400px"}
          readOnly={readOnly ?? !isOwner}
        />
      ) : (
        <p className="text-muted-foreground px-3 py-4 text-xs">Could not load protocol code</p>
      )}
    </CellWrapper>
  );
}
