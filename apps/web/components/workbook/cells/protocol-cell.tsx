"use client";

import { DocsHelpLink } from "@/components/docs-help-link";
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
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { parseApiError } from "~/util/apiError";

import type { SensorFamily } from "@repo/api/domains/protocol/protocol.schema";
import type { ProtocolCell as ProtocolCellType } from "@repo/api/domains/workbook/workbook-cells.schema";
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

import { CellTitle } from "../cell-title";
import { CellWrapper } from "../cell-wrapper";
import { WorkbookCodeEditor } from "../workbook-code-editor";
import {
  useWorkbookEntitySaved,
  useWorkbookExecutableEdit,
} from "../workbook-entity-saved-context";

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
  const protocolName = protocolData?.name;
  // Newly-created protocols have an empty code array; render that as "[]" so owners can fill it in
  // rather than treating it as a load failure.
  const protocolCode = useSnapshot
    ? JSON.stringify(snapshot.code ?? [], null, 2)
    : protocolData?.code
      ? JSON.stringify(protocolData.code, null, 2)
      : null;

  const protocolFamily = useSnapshot ? snapshot.family : protocolData?.family;
  const isOwner = !!session?.user.id && session.user.id === protocolData?.createdBy;
  const isEditable = isOwner && !readOnly;
  // Read-only purely because the viewer did not create this protocol (not
  // because the cell is rendered from a pinned snapshot or in a read-only host).
  const isReadOnlyForNonOwner = !useSnapshot && !readOnly && !!protocolData && !isOwner;
  // Lineage: this protocol is itself a fork of another one.
  const forkedFrom = useSnapshot ? undefined : protocolData?.forkedFrom;

  const { mutateAsync: saveProtocol } = useProtocolUpdate(protocolId);
  const { mutateAsync: forkProtocol, isPending: isForking } = useProtocolCreate();
  const onEntitySaved = useWorkbookEntitySaved();
  const onExecutableEdit = useWorkbookExecutableEdit();

  const [localCode, setLocalCode] = useState<string | null>(null);

  // Editing protocol code invalidates runtime freshness synchronously BEFORE the
  // editor state changes, so an in-flight producer cannot commit against the old
  // code. Runs ahead of debounced persistence.
  const handleCodeChange = useCallback(
    (code: string) => {
      onExecutableEdit();
      setLocalCode(code);
    },
    [onExecutableEdit],
  );

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
          id: protocolId,
          code: JSON.parse(code) as Record<string, unknown>[],
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
    const src = protocolData;
    if (!src) return;
    try {
      const suffix = crypto.randomUUID().slice(0, 8);
      const res = await forkProtocol({
        name: `Copy of ${src.name}`.slice(0, 246) + ` ${suffix}`,
        description: src.description ?? undefined,
        code: src.code,
        family: src.family,
        forkedFrom: src.id,
      });
      // A successful fork repoints this cell at different executable code;
      // invalidate synchronously before the cell payload changes.
      onExecutableEdit();
      onUpdate({
        ...cell,
        payload: { ...cell.payload, protocolId: res.id, name: res.name },
      });
    } catch {
      // useProtocolCreate already surfaces the error toast.
    }
  }, [protocolData, forkProtocol, onUpdate, cell, onExecutableEdit]);

  // Track the latest cell so the async rename merges into current state, not a
  // stale snapshot from when the save began. Sync in a layout effect (not during
  // render) so a speculative render never leaks into the ref.
  const cellRef = useRef(cell);
  useLayoutEffect(() => {
    cellRef.current = cell;
  }, [cell]);

  // Rename the shared protocol row and repoint the cell label at the new name.
  // Renaming a fork resolves the auto-generated "Copy of ..." name in place.
  const [isRenaming, setIsRenaming] = useState(false);
  const handleRename = useCallback(
    async (next: string) => {
      setIsRenaming(true);
      try {
        const res = await saveProtocol({ id: protocolId, name: next });
        const latest = cellRef.current;
        onUpdate({ ...latest, payload: { ...latest.payload, name: res.name } });
      } catch (err) {
        const parsed = parseApiError(err);
        toast({
          description:
            parsed?.code === "REPOSITORY_DUPLICATE"
              ? tWorkbook("cells.renameConflict")
              : (parsed?.message ?? tWorkbook("cells.renameFailed")),
          variant: "destructive",
        });
        throw err;
      } finally {
        setIsRenaming(false);
      }
    },
    [protocolId, saveProtocol, onUpdate, tWorkbook],
  );

  const displayName = cell.payload.name ?? protocolName ?? "Protocol";

  return (
    <CellWrapper
      icon={<Microscope className="h-3.5 w-3.5" />}
      label={
        <CellTitle
          name={displayName}
          canRename={isEditable}
          onRename={handleRename}
          isPending={isRenaming}
          labels={{
            rename: tWorkbook("cells.rename"),
            save: tWorkbook("cells.renameSave"),
            cancel: tWorkbook("cells.renameCancel"),
          }}
        />
      }
      labelText={displayName}
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
          <DocsHelpLink
            iconOnly
            path="/guide/devices-protocols/writing-protocols"
            className="h-7 w-7 justify-center"
          />
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
          onChange={isEditable ? handleCodeChange : undefined}
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
