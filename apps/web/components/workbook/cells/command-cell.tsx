"use client";

import { AutosaveIndicator } from "@/components/shared/autosave/autosave-indicator";
import { useCommand } from "@/hooks/command/useCommand/useCommand";
import { useCommandCreate } from "@/hooks/command/useCommandCreate/useCommandCreate";
import { useCommandUpdate } from "@/hooks/command/useCommandUpdate/useCommandUpdate";
import { useAutosave } from "@/hooks/useAutosave";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { registerCommandCodeSource } from "@/lib/command-code-registry";
import { getSensorFamilyLabel } from "@/util/sensor-family";
import {
  Check,
  Copy,
  ExternalLink,
  GitFork,
  Hand,
  Loader2,
  Microscope,
  Terminal,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { parseApiError } from "~/util/apiError";

import type { SensorFamily } from "@repo/api/schemas/command.schema";
import type { CommandFormat } from "@repo/api/schemas/experiment.schema";
import type {
  CommandCell as CommandCellType,
  CommandInlinePayload,
  CommandReferencePayload,
} from "@repo/api/schemas/workbook-cells.schema";
import { isCommandReferencePayload } from "@repo/api/schemas/workbook-cells.schema";
import { validateInlineCommand } from "@repo/api/utils/command-payload";
import { useSession } from "@repo/auth/client";
import { useTranslation } from "@repo/i18n";
import { commandRequiresInteraction } from "@repo/iot";
import { Button } from "@repo/ui/components/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/ui/components/tooltip";
import { toast } from "@repo/ui/hooks/use-toast";

import { buildCommandExtensions } from "../../shared/command-completions";
import { CellWrapper } from "../cell-wrapper";
import { WorkbookCodeEditor } from "../workbook-code-editor";
import type { EditorLanguage } from "../workbook-code-editor";
import { useWorkbookEntitySaved } from "../workbook-entity-saved-context";

interface CommandCellProps {
  cell: CommandCellType;
  onUpdate: (cell: CommandCellType) => void;
  onDelete: () => void;
  onRun?: () => void;
  executionStatus?: "idle" | "running" | "completed" | "error";
  executionError?: string;
  readOnly?: boolean;
  // Immutable code/family pinned at publish time (reference payloads only).
  // When present the cell renders exclusively from it and never fetches the
  // live command row. `code` is optional because the snapshot schema types it
  // as `unknown`.
  snapshot?: { code?: unknown; family?: SensorFamily };
}

// A command cell either references a versioned library command or carries an
// inline payload; each variant keeps its own UI.
export function CommandCellComponent(props: CommandCellProps) {
  const payload = props.cell.payload;
  if (isCommandReferencePayload(payload)) {
    return <CommandReferenceCell {...props} payload={payload} />;
  }
  return <CommandInlineCell {...props} payload={payload} />;
}

// ── Library reference variant ────────────────────────────────────────────────

function CommandReferenceCell({
  cell,
  payload,
  onUpdate,
  onDelete,
  onRun,
  executionStatus,
  executionError,
  readOnly,
  snapshot,
}: CommandCellProps & { payload: CommandReferencePayload }) {
  const commandId = payload.commandId;
  const { copy, copied } = useCopyToClipboard();
  const { data: session } = useSession();
  const { t } = useTranslation("iot");
  const { t: tWorkbook } = useTranslation("workbook");

  const useSnapshot = snapshot != null;
  const { data: commandData, isLoading: liveLoading } = useCommand(commandId, !useSnapshot);
  const commandLoading = !useSnapshot && liveLoading;
  const commandName = commandData?.body.name;
  // Newly-created commands have an empty code array; render that as "[]" so owners can fill it in
  // rather than treating it as a load failure.
  const commandCode = useSnapshot
    ? JSON.stringify(snapshot.code ?? [], null, 2)
    : commandData?.body.code
      ? JSON.stringify(commandData.body.code, null, 2)
      : null;

  const commandFamily = useSnapshot ? snapshot.family : commandData?.body.family;
  const isOwner = !!session?.user.id && session.user.id === commandData?.body.createdBy;
  const isEditable = isOwner && !readOnly;
  // Read-only purely because the viewer did not create this command (not
  // because the cell is rendered from a pinned snapshot or in a read-only host).
  const isReadOnlyForNonOwner = !useSnapshot && !readOnly && !!commandData && !isOwner;
  // Lineage: this command is itself a fork of another one.
  const forkedFrom = useSnapshot ? undefined : commandData?.body.forkedFrom;

  const { mutateAsync: saveCommand } = useCommandUpdate(commandId);
  const { mutateAsync: forkCommand, isPending: isForking } = useCommandCreate();
  const onEntitySaved = useWorkbookEntitySaved();

  const [localCode, setLocalCode] = useState<string | null>(null);

  useEffect(() => {
    if (commandCode != null && localCode == null) {
      setLocalCode(commandCode);
    }
  }, [commandCode, localCode]);

  // Mirror the standalone command/macro editors: persist via the shared
  // `useAutosave` hook so debounce, status and flush behave identically across
  // all three editors. Command code is a JSON array; `isValid` skips saves
  // while the editor is mid-keystroke with text that does not yet parse.
  const save = useCallback(
    async (code: string) => {
      try {
        await saveCommand({
          params: { id: commandId },
          body: { code: JSON.parse(code) as Record<string, unknown>[] },
        });
        onEntitySaved();
      } catch (err) {
        toast({ description: parseApiError(err)?.message, variant: "destructive" });
        throw err;
      }
    },
    [commandId, saveCommand, onEntitySaved],
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
    () => registerCommandCodeSource(commandId, getCurrentCode),
    [commandId, getCurrentCode],
  );

  // Commands with a physical open/close clamp gate (par_led_start_on_*) pause
  // with the device silent until the user acts. Surface a prompt while the cell
  // runs so it does not look hung. See OJD-1643.
  const requiresInteraction = useMemo(() => {
    const raw = localCode ?? commandCode;
    if (raw == null) return false;
    try {
      return commandRequiresInteraction(JSON.parse(raw));
    } catch {
      return false;
    }
  }, [localCode, commandCode]);

  const handleCopy = () => {
    void copy(localCode ?? commandCode ?? "");
  };

  // Fork a command the viewer does not own into an editable copy they do, then
  // point this cell at the copy so it becomes editable in place.
  const handleFork = useCallback(async () => {
    const src = commandData?.body;
    if (!src) return;
    try {
      const suffix = crypto.randomUUID().slice(0, 8);
      const res = await forkCommand({
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
        payload: { ...payload, commandId: res.body.id, name: res.body.name },
      });
    } catch {
      // useCommandCreate already surfaces the error toast.
    }
  }, [commandData, forkCommand, onUpdate, cell, payload]);

  const displayName = payload.name ?? commandName ?? "Command";

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
        commandFamily ||
        (isEditable && localCode != null) ||
        isReadOnlyForNonOwner ||
        forkedFrom ? (
          <div className="flex items-center gap-2">
            {commandFamily ? (
              <span className="text-xs capitalize text-[#68737B]">
                {getSensorFamilyLabel(commandFamily)}
              </span>
            ) : null}
            {forkedFrom ? (
              <Link
                href={`/platform/commands/${forkedFrom}`}
                className="text-xs text-[#005E5E] underline underline-offset-2 hover:text-[#004848]"
              >
                {tWorkbook("cells.forkedFrom")}
              </Link>
            ) : null}
            {isReadOnlyForNonOwner ? (
              <>
                <span className="text-muted-foreground text-xs">
                  {tWorkbook("cells.commandReadOnly")}
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
            title="Open command in new tab"
          >
            <Link
              href={`/platform/commands/${commandId}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open command in new tab"
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
            <p className="text-sm font-medium">{t("iot.commandRunner.interactionTitle")}</p>
            <p className="text-muted-foreground mt-0.5 text-sm">
              {t("iot.commandRunner.interactionHint")}
            </p>
          </div>
        </div>
      ) : null}
      {commandLoading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
        </div>
      ) : localCode != null || commandCode != null ? (
        <WorkbookCodeEditor
          value={localCode ?? commandCode ?? ""}
          onChange={isEditable ? setLocalCode : undefined}
          language="json"
          minHeight={isEditable ? "120px" : "80px"}
          maxHeight={isEditable ? "500px" : "400px"}
          readOnly={!isEditable}
        />
      ) : (
        <p className="text-muted-foreground px-3 py-4 text-xs">Could not load command code</p>
      )}
    </CellWrapper>
  );
}

// ── Inline variant ───────────────────────────────────────────────────────────

const FORMAT_LABELS: Record<CommandFormat, string> = {
  string: "String",
  json: "JSON",
  yaml: "YAML",
};

const FORMAT_LANGUAGE: Record<CommandFormat, EditorLanguage> = {
  string: "text",
  json: "json",
  yaml: "yaml",
};

function CommandInlineCell({
  cell,
  payload,
  onUpdate,
  onDelete,
  onRun,
  executionStatus,
  executionError,
  readOnly,
}: CommandCellProps & { payload: CommandInlinePayload }) {
  const { copy, copied } = useCopyToClipboard();
  const { format, content } = payload;

  const validation = useMemo(() => validateInlineCommand({ format, content }), [format, content]);

  // Known-command autocomplete + hover hints only apply to the free-text `string`
  // format; json/yaml payloads are structured, not a single command word.
  const commandExtensions = useMemo(
    () =>
      format === "string"
        ? buildCommandExtensions({
            singleLine: true,
            placeholder: "Type a command, e.g. battery",
            readOnly,
          })
        : undefined,
    [format, readOnly],
  );

  // A single-line command reads as an input, not a code block; drop the gutter.
  const commandBasicSetup = useMemo(
    () =>
      format === "string"
        ? {
            lineNumbers: false,
            foldGutter: false,
            highlightActiveLine: false,
            highlightActiveLineGutter: false,
          }
        : undefined,
    [format],
  );

  const update = (patch: Partial<CommandInlinePayload>) =>
    onUpdate({ ...cell, payload: { ...payload, ...patch } });

  const displayName = payload.name ?? (content || "Command");

  return (
    <CellWrapper
      icon={<Terminal className="h-3.5 w-3.5" />}
      label={displayName}
      accentColor="#119DA4"
      isCollapsed={cell.isCollapsed}
      onToggleCollapse={(collapsed) => onUpdate({ ...cell, isCollapsed: collapsed })}
      onDelete={onDelete}
      onRun={onRun}
      executionStatus={executionStatus}
      executionError={executionError}
      readOnly={readOnly}
      headerActions={
        <div className="flex items-center gap-1">
          {!readOnly ? (
            <Select value={format} onValueChange={(v) => update({ format: v as CommandFormat })}>
              <SelectTrigger className="h-7 w-[90px] text-xs" aria-label="Command format">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["string", "json", "yaml"] as const).map((f) => (
                  <SelectItem key={f} value={f} className="text-xs">
                    {FORMAT_LABELS[f]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <span className="text-xs uppercase text-[#68737B]">{FORMAT_LABELS[format]}</span>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground h-7 w-7 p-0"
            onClick={() => void copy(content)}
          >
            {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
          </Button>
        </div>
      }
    >
      <div className="space-y-2">
        <WorkbookCodeEditor
          value={content}
          onChange={readOnly ? undefined : (v) => update({ content: v })}
          language={FORMAT_LANGUAGE[format]}
          minHeight={format === "string" ? "44px" : readOnly ? "80px" : "120px"}
          maxHeight="400px"
          readOnly={readOnly}
          extraExtensions={commandExtensions}
          basicSetup={commandBasicSetup}
        />
        {!validation.ok ? <p className="text-xs text-red-500">{validation.error}</p> : null}
      </div>
    </CellWrapper>
  );
}
