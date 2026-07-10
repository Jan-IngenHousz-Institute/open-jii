"use client";

import { AutosaveIndicator } from "@/components/shared/autosave/autosave-indicator";
import { useProtocol } from "@/hooks/protocol/useProtocol/useProtocol";
import { useProtocolCreate } from "@/hooks/protocol/useProtocolCreate/useProtocolCreate";
import { useProtocolUpdate } from "@/hooks/protocol/useProtocolUpdate/useProtocolUpdate";
import { useAutosave } from "@/hooks/useAutosave";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { registerProtocolCodeSource } from "@/lib/protocol-code-registry";
import { getSensorFamilyLabel } from "@/util/sensor-family";
import { Check, Copy, ExternalLink, GitFork, Hand, Loader2, Microscope } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { parseApiError } from "~/util/apiError";

import type { SensorFamily } from "@repo/api/schemas/protocol.schema";
import type { ProtocolCell as ProtocolCellType } from "@repo/api/schemas/workbook-cells.schema";
import { useSession } from "@repo/auth/client";
import { useTranslation } from "@repo/i18n";
import { protocolRequiresInteraction } from "@repo/iot";
import { Button } from "@repo/ui/components/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/ui/components/tooltip";
import { toast } from "@repo/ui/hooks/use-toast";

import { CellWrapper } from "../cell-wrapper";
import { WorkbookCodeEditor } from "../workbook-code-editor";
import { useWorkbookEntitySaved } from "../workbook-entity-saved-context";

interface ProtocolCellProps {
  cell: ProtocolCellType;
  onUpdate: (cell: ProtocolCellType) => void;
  onDelete: () => void;
  onRun?: () => void;
  executionStatus?: "idle" | "running" | "completed" | "error";
  executionError?: string;
  readOnly?: boolean;
  // Immutable code/family pinned at publish time. When present the cell renders
  // exclusively from it and never fetches the live protocol row. `code` is
  // optional because the snapshot schema types it as `unknown`.
  snapshot?: { code?: unknown; family?: SensorFamily };
}

export function ProtocolCellComponent({
  cell,
  onUpdate,
  onDelete,
  onRun,
  executionStatus,
  executionError,
  readOnly,
  snapshot,
}: ProtocolCellProps) {
  const protocolId = cell.payload.protocolId;
  const { copy, copied } = useCopyToClipboard();
  const { data: session } = useSession();
  const { t } = useTranslation("iot");
  const { t: tWorkbook } = useTranslation("workbook");

  const useSnapshot = snapshot != null;
  const { data: protocolData, isLoading: liveLoading } = useProtocol(protocolId, !useSnapshot);
  const protocolLoading = !useSnapshot && liveLoading;
  const protocolName = protocolData?.body.name;
  // Newly-created protocols have an empty code array; render that as "[]" so owners can fill it in
  // rather than treating it as a load failure.
  const protocolCode = useSnapshot
    ? JSON.stringify(snapshot.code ?? [], null, 2)
    : protocolData?.body.code
      ? JSON.stringify(protocolData.body.code, null, 2)
      : null;

  const protocolFamily = useSnapshot ? snapshot.family : protocolData?.body.family;
  const isOwner = !!session?.user.id && session.user.id === protocolData?.body.createdBy;
  const isEditable = isOwner && !readOnly;
  // Read-only purely because the viewer did not create this protocol (not
  // because the cell is rendered from a pinned snapshot or in a read-only host).
  const isReadOnlyForNonOwner = !useSnapshot && !readOnly && !!protocolData && !isOwner;
  // Lineage: this protocol is itself a fork of another one.
  const forkedFrom = useSnapshot ? undefined : protocolData?.body.forkedFrom;

  const { mutateAsync: saveProtocol } = useProtocolUpdate(protocolId);
  const { mutateAsync: forkProtocol, isPending: isForking } = useProtocolCreate();
  const onEntitySaved = useWorkbookEntitySaved();

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
        onEntitySaved();
      } catch (err) {
        toast({ description: parseApiError(err)?.message, variant: "destructive" });
        throw err;
      }
    },
    [protocolId, saveProtocol, onEntitySaved],
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
  // is on screen (no backend round-trip) while autosave persists in the
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

  // Protocols with a physical open/close clamp gate (par_led_start_on_*) pause
  // with the device silent until the user acts. Surface a prompt while the cell
  // runs so it does not look hung. See OJD-1643.
  const requiresInteraction = useMemo(() => {
    const raw = localCode ?? protocolCode;
    if (raw == null) return false;
    try {
      return protocolRequiresInteraction(JSON.parse(raw));
    } catch {
      return false;
    }
  }, [localCode, protocolCode]);

  const handleCopy = () => {
    void copy(localCode ?? protocolCode ?? "");
  };

  // Fork a protocol the viewer does not own into an editable copy they do, then
  // point this cell at the copy so it becomes editable in place.
  const handleFork = useCallback(async () => {
    const src = protocolData?.body;
    if (!src) return;
    try {
      const suffix = crypto.randomUUID().slice(0, 8);
      const res = await forkProtocol({
        body: {
          name: `Copy of ${src.name}`.slice(0, 246) + ` ${suffix}`,
          description: src.description ?? undefined,
          code: src.code,
          family: src.family,
          forkedFrom: src.id,
        },
      });
      onUpdate({
        ...cell,
        payload: { ...cell.payload, protocolId: res.body.id, name: res.body.name },
      });
    } catch {
      // useProtocolCreate already surfaces the error toast.
    }
  }, [protocolData, forkProtocol, onUpdate, cell]);

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
        protocolFamily ||
        (isEditable && localCode != null) ||
        isReadOnlyForNonOwner ||
        forkedFrom ? (
          <div className="flex items-center gap-2">
            {protocolFamily ? (
              <span className="text-xs capitalize text-[#68737B]">
                {getSensorFamilyLabel(protocolFamily)}
              </span>
            ) : null}
            {forkedFrom ? (
              <Link
                href={`/platform/protocols/${forkedFrom}`}
                className="text-xs text-[#005E5E] underline underline-offset-2 hover:text-[#004848]"
              >
                {tWorkbook("cells.forkedFrom")}
              </Link>
            ) : null}
            {isReadOnlyForNonOwner ? (
              <>
                <span className="text-muted-foreground text-xs">
                  {tWorkbook("cells.protocolReadOnly")}
                </span>
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground h-6 w-6 shrink-0 p-0 hover:text-[#005E5E]"
                        aria-label={tWorkbook("cells.fork")}
                        onClick={() => void handleFork()}
                        disabled={isForking}
                      >
                        {isForking ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <GitFork className="h-3 w-3" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{tWorkbook("cells.fork")}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </>
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
      {executionStatus === "running" && requiresInteraction ? (
        <div className="bg-muted text-foreground mx-3 mb-2 flex items-start gap-2 rounded-lg p-3">
          <Hand className="text-primary mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium">{t("iot.protocolRunner.interactionTitle")}</p>
            <p className="text-muted-foreground mt-0.5 text-sm">
              {t("iot.protocolRunner.interactionHint")}
            </p>
          </div>
        </div>
      ) : null}
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
          readOnly={!isEditable}
        />
      ) : (
        <p className="text-muted-foreground px-3 py-4 text-xs">Could not load protocol code</p>
      )}
    </CellWrapper>
  );
}
