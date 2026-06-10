"use client";

import { useProtocol } from "@/hooks/protocol/useProtocol/useProtocol";
import { useProtocolUpdate } from "@/hooks/protocol/useProtocolUpdate/useProtocolUpdate";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { registerProtocolFlush } from "@/lib/protocol-save-registry";
import { getSensorFamilyLabel } from "@/util/sensor-family";
import {
  AlertTriangle,
  Check,
  CircleCheck,
  Copy,
  ExternalLink,
  Loader2,
  Microscope,
  Pencil,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import type { ProtocolCell as ProtocolCellType } from "@repo/api/schemas/workbook-cells.schema";
import { useSession } from "@repo/auth/client";
import { Button } from "@repo/ui/components/button";

import { CellWrapper } from "../cell-wrapper";
import { WorkbookCodeEditor } from "../workbook-code-editor";

// "idle" = in sync with the server (nothing to show). The others surface the
// fate of the owner's edits so a pending/skipped save is never invisible.
type SaveStatus = "idle" | "unsaved" | "saving" | "saved" | "invalid" | "error";

function SaveStatusIndicator({ status }: { status: SaveStatus }) {
  if (status === "idle") return null;

  const content = {
    unsaved: {
      icon: <Pencil className="h-3 w-3" />,
      label: "Unsaved changes",
      className: "text-[#68737B]",
    },
    saving: {
      icon: <Loader2 className="h-3 w-3 animate-spin" />,
      label: "Saving…",
      className: "text-[#68737B]",
    },
    saved: {
      icon: <CircleCheck className="h-3 w-3" />,
      label: "Saved",
      className: "text-emerald-600",
    },
    invalid: {
      icon: <AlertTriangle className="h-3 w-3" />,
      label: "Invalid JSON — not saved",
      className: "text-amber-600",
    },
    error: {
      icon: <AlertTriangle className="h-3 w-3" />,
      label: "Save failed",
      className: "text-red-600",
    },
  }[status];

  return (
    <span
      data-testid="protocol-save-status"
      data-status={status}
      role="status"
      aria-live="polite"
      className={`flex items-center gap-1 text-xs ${content.className}`}
    >
      {content.icon}
      {content.label}
    </span>
  );
}

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

  const { mutateAsync: saveProtocol } = useProtocolUpdate(protocolId);

  const [localCode, setLocalCode] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedKeyRef = useRef<string>("");
  // Holds a valid, parsed edit that has not been persisted yet. Lets us flush
  // the debounced save on demand (e.g. just before a run) or on unmount.
  const pendingRef = useRef<{ key: string; code: Record<string, unknown>[] } | null>(null);
  // Avoid setting status after unmount (the unmount handler flushes).
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (protocolCode != null && localCode == null) {
      setLocalCode(protocolCode);
      savedKeyRef.current = protocolCode;
    }
  }, [protocolCode, localCode]);

  // Persist any pending edit immediately, resolving once the save completes.
  const flushSave = useCallback(async () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    const pending = pendingRef.current;
    if (!pending) return;
    if (mountedRef.current) setSaveStatus("saving");
    try {
      await saveProtocol({ params: { id: protocolId }, body: { code: pending.code } });
      savedKeyRef.current = pending.key;
      pendingRef.current = null;
      if (mountedRef.current) setSaveStatus("saved");
    } catch {
      // Leave the edit pending so a later flush or edit retries it.
      if (mountedRef.current) setSaveStatus("error");
    }
  }, [protocolId, saveProtocol]);

  // Expose the flush to the run flow, and flush once more on unmount so an edit
  // made within the debounce window is never silently dropped.
  useEffect(() => {
    const unregister = registerProtocolFlush(protocolId, flushSave);
    return () => {
      unregister();
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      void flushSave();
    };
  }, [protocolId, flushSave]);

  const handleCodeChange = useCallback(
    (code: string) => {
      setLocalCode(code);

      if (code === savedKeyRef.current) {
        // Edit reverted back to the saved state — drop any pending save.
        pendingRef.current = null;
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
          saveTimeoutRef.current = null;
        }
        setSaveStatus("idle");
        return;
      }

      // Protocol code is a JSON array; only persist when the editor contents parse successfully.
      let parsed: unknown;
      try {
        parsed = JSON.parse(code);
      } catch {
        setSaveStatus("invalid");
        return;
      }
      if (!Array.isArray(parsed)) {
        setSaveStatus("invalid");
        return;
      }

      pendingRef.current = { key: code, code: parsed as Record<string, unknown>[] };
      setSaveStatus("unsaved");
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        saveTimeoutRef.current = null;
        void flushSave();
      }, 1000);
    },
    [flushSave],
  );

  const handleCopy = () => {
    void copy(localCode ?? protocolCode ?? "");
  };

  const displayName = cell.payload.name ?? protocolName ?? "Protocol";
  const isEditable = isOwner && !readOnly;

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
        protocolFamily || isEditable ? (
          <div className="flex items-center gap-2">
            {protocolFamily ? (
              <span className="text-xs capitalize text-[#68737B]">
                {getSensorFamilyLabel(protocolFamily)}
              </span>
            ) : null}
            {isEditable ? <SaveStatusIndicator status={saveStatus} /> : null}
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
          onChange={isEditable ? handleCodeChange : undefined}
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
