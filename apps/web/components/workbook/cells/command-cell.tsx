"use client";

import { DocsHelpLink } from "@/components/docs-help-link";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import type { CommandResolvedPreview } from "@/hooks/workbook/useWorkbookExecution/useWorkbookExecution";
import {
  dynamicCommandIssueKey,
  eligibleCommandSources,
  fieldSuggestions,
  refForSourceSelection,
  refIssueForCommand,
  sourceTypeLabelKey,
} from "@/lib/workbook/dynamic-command-authoring";
import { Check, Copy, Terminal } from "lucide-react";
import { useFeatureFlagEnabled } from "posthog-js/react";
import { useId, useMemo } from "react";

import { FEATURE_FLAGS } from "@repo/analytics";
import type { CommandFormat } from "@repo/api/domains/experiment/experiment.schema";
import { isReferencedCommandPayload } from "@repo/api/domains/workbook/command-source.schema";
import type {
  ReferencedCommandPayload,
  StaticCommandPayload,
} from "@repo/api/domains/workbook/command-source.schema";
import type {
  CommandCell as CommandCellType,
  WorkbookCell,
} from "@repo/api/domains/workbook/workbook-cells.schema";
import { dynamicCommandNodeLabel } from "@repo/api/transforms/cells-to-flow";
import { validateInlineCommand } from "@repo/api/transforms/command-payload";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@repo/ui/components/tooltip";

import { buildCommandExtensions } from "../../shared/command-completions";
import { CellWrapper } from "../cell-wrapper";
import { WorkbookCodeEditor } from "../workbook-code-editor";
import type { EditorLanguage } from "../workbook-code-editor";

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

const ACCENT = "#119DA4";

interface CommandCellProps {
  cell: CommandCellType;
  onUpdate: (cell: CommandCellType) => void;
  onDelete: () => void;
  onRun?: () => void;
  executionStatus?: "idle" | "running" | "completed" | "error";
  executionError?: string;
  readOnly?: boolean;
  /** All workbook cells, for the earlier-source picker + broken-ref diagnosis. */
  allCells?: WorkbookCell[];
  /** Runtime-only resolved value/error per device for a dynamic (ref) cell. */
  preview?: CommandResolvedPreview;
}

export function CommandCellComponent({
  cell,
  onUpdate,
  onDelete,
  onRun,
  executionStatus,
  executionError,
  readOnly,
  allCells,
  preview,
}: CommandCellProps) {
  const { copy, copied } = useCopyToClipboard();
  const { t } = useTranslation("common");
  const { t: tWorkbook } = useTranslation("workbook");
  const fieldListId = useId();

  // Authoring (create/edit/repair a ref) is gated by a conservative, default-off
  // flag AND ownership. When it is off, static authoring is unchanged and a ref
  // cell renders read-only but remains fully visible/runnable.
  const authoringEnabled =
    (useFeatureFlagEnabled(FEATURE_FLAGS.DYNAMIC_COMMAND_AUTHORING) ?? false) ? !readOnly : false;

  const refPayload: ReferencedCommandPayload | null = isReferencedCommandPayload(cell.payload)
    ? cell.payload
    : null;
  const staticPayload: StaticCommandPayload = isReferencedCommandPayload(cell.payload)
    ? { format: "string", content: "" }
    : cell.payload;
  const { format, content } = staticPayload;

  const validation = useMemo(() => validateInlineCommand({ format, content }), [format, content]);

  const commandExtensions = useMemo(
    () =>
      format === "string"
        ? buildCommandExtensions({
            singleLine: true,
            placeholder: t("experiments.commandPanelPlaceholder"),
            readOnly,
          })
        : undefined,
    [format, readOnly, t],
  );

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

  const update = (patch: Partial<StaticCommandPayload>) =>
    onUpdate({ ...cell, payload: { ...staticPayload, ...patch } });

  // Mode switching replaces the payload variant wholesale: no hidden static
  // content survives into ref mode and no ref survives into static mode. The
  // optional author name is preserved as metadata (not command content).
  const switchToDynamic = () =>
    onUpdate({
      ...cell,
      payload: {
        kind: "ref",
        ref: { sourceCellId: "", field: "" },
        ...(cell.payload.name ? { name: cell.payload.name } : {}),
      },
    });
  const switchToStatic = () =>
    onUpdate({
      ...cell,
      payload: {
        format: "string",
        content: "",
        ...(cell.payload.name ? { name: cell.payload.name } : {}),
      },
    });

  const modeToggle = authoringEnabled ? (
    <div
      className="flex items-center gap-1"
      role="group"
      aria-label={tWorkbook("cells.commandDynamic.modeGroup")}
    >
      <Button
        variant={refPayload ? "ghost" : "secondary"}
        size="sm"
        className="h-7 px-2 text-xs"
        aria-pressed={!refPayload}
        data-testid="command-mode-static"
        onClick={() => refPayload && switchToStatic()}
      >
        {tWorkbook("cells.commandDynamic.modeStatic")}
      </Button>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={refPayload ? "secondary" : "ghost"}
            size="sm"
            className="h-7 px-2 text-xs"
            aria-pressed={!!refPayload}
            data-testid="command-mode-dynamic"
            onClick={() => !refPayload && switchToDynamic()}
          >
            {tWorkbook("cells.commandDynamic.modeDynamic")}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{tWorkbook("cells.commandDynamic.tooltip")}</TooltipContent>
      </Tooltip>
    </div>
  ) : null;

  const previewBlock =
    preview && preview.perDevice.length > 0 ? (
      <div className="mt-1 space-y-0.5 border-t border-dashed pt-1" data-testid="command-preview">
        {preview.perDevice.map((d) => (
          <p key={d.deviceId}>
            <span className="text-[#68737B]">{d.deviceLabel ?? d.deviceId}:</span>{" "}
            {d.errorCode ? (
              <span className="text-red-500">{d.errorCode}</span>
            ) : (
              <span className="font-mono text-emerald-600">{d.resolved}</span>
            )}
          </p>
        ))}
      </div>
    ) : null;

  // ── Dynamic (ref) cell ─────────────────────────────────────────────────────
  if (refPayload) {
    const label = dynamicCommandNodeLabel({ name: cell.payload.name, field: refPayload.ref.field });
    const issue = allCells ? refIssueForCommand(allCells, cell.id) : undefined;
    const guidance = issue ? tWorkbook(dynamicCommandIssueKey(issue.code)) : undefined;

    // Read-only: authoring flag off (or non-owner). Fully visible, runnable, and
    // collapsible, but structurally LOCKED (no delete/edit/convert). Dropping
    // `onDelete` hides the delete control while Run + collapse stay live; the
    // exact authored ref payload is never mutated.
    if (!authoringEnabled) {
      return (
        <CellWrapper
          icon={<Terminal className="h-3.5 w-3.5" />}
          label={label}
          accentColor={ACCENT}
          isCollapsed={cell.isCollapsed}
          onToggleCollapse={(collapsed) => onUpdate({ ...cell, isCollapsed: collapsed })}
          onRun={onRun}
          executionStatus={executionStatus}
          executionError={executionError}
          readOnly={readOnly}
          headerActions={
            <span className="text-xs uppercase text-[#68737B]">{tWorkbook("cells.command")}</span>
          }
        >
          <div className="space-y-1 text-xs">
            <p className="text-muted-foreground">
              {tWorkbook("cells.commandDynamic.readOnlyNote")}
            </p>
            <p>
              <span className="text-[#68737B]">
                {tWorkbook("cells.commandDynamic.sourceLabel")}:
              </span>{" "}
              <span className="font-mono">
                {refPayload.ref.sourceCellId || tWorkbook("cells.commandDynamic.none")}
              </span>
            </p>
            <p>
              <span className="text-[#68737B]">
                {tWorkbook("cells.commandDynamic.fieldLabel")}:
              </span>{" "}
              <span className="font-mono">
                {refPayload.ref.field || tWorkbook("cells.commandDynamic.none")}
              </span>
            </p>
            {guidance ? (
              <p className="text-amber-600" data-testid="command-ref-issue">
                {guidance}
              </p>
            ) : null}
            {previewBlock}
          </div>
        </CellWrapper>
      );
    }

    const commonWrapper = {
      icon: <Terminal className="h-3.5 w-3.5" />,
      label,
      accentColor: ACCENT,
      isCollapsed: cell.isCollapsed,
      onToggleCollapse: (collapsed: boolean) => onUpdate({ ...cell, isCollapsed: collapsed }),
      onDelete,
      onRun,
      executionStatus,
      executionError,
      readOnly,
    };

    // Authoring: pick an earlier eligible source + a top-level field.
    const sources = allCells ? eligibleCommandSources(allCells, cell.id) : [];
    const currentSourceId = refPayload.ref.sourceCellId;
    const currentSource = allCells?.find((c) => c.id === currentSourceId && c.type !== "output");
    const isQuestionSource = currentSource?.type === "question";
    // Preserve a broken/deleted/reordered source id as a visible, selectable
    // option so it is never silently dropped or auto-repaired.
    const sourceMissingFromList =
      currentSourceId.length > 0 && !sources.some((s) => s.id === currentSourceId);
    const suggestions = allCells ? fieldSuggestions(allCells, currentSourceId) : [];

    const updateRef = (patch: Partial<ReferencedCommandPayload["ref"]>) =>
      onUpdate({
        ...cell,
        payload: { ...refPayload, ref: { ...refPayload.ref, ...patch } },
      });

    // Selecting a source persists the whole ref atomically (source + field) via
    // the shared rule, so a question pins `answer` and moving off a question
    // never retains a stale `answer`. See refForSourceSelection.
    const onSelectSource = (nextId: string) =>
      updateRef(refForSourceSelection(allCells ?? [], refPayload.ref, nextId));

    return (
      <CellWrapper {...commonWrapper} headerActions={modeToggle}>
        <div className="space-y-2 text-xs">
          <div className="space-y-1">
            <span className="text-[#68737B]">
              {tWorkbook("cells.commandDynamic.sourcePickerLabel")}
            </span>
            <Select value={currentSourceId || undefined} onValueChange={onSelectSource}>
              <SelectTrigger
                className="h-7 text-xs"
                aria-label={tWorkbook("cells.commandDynamic.sourceAria")}
                data-testid="command-source"
              >
                <SelectValue placeholder={tWorkbook("cells.commandDynamic.sourcePlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {sourceMissingFromList ? (
                  <SelectItem value={currentSourceId} className="text-xs text-amber-600">
                    {tWorkbook("cells.commandDynamic.sourceUnavailable", { id: currentSourceId })}
                  </SelectItem>
                ) : null}
                {sources.map((s) => (
                  <SelectItem key={s.id} value={s.id} className="text-xs">
                    {s.name ?? tWorkbook(sourceTypeLabelKey(s.type))} ·{" "}
                    {tWorkbook(sourceTypeLabelKey(s.type))}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <span className="text-[#68737B]">{tWorkbook("cells.commandDynamic.fieldLabel")}</span>
            {isQuestionSource ? (
              <div data-testid="command-field-question" className="text-muted-foreground">
                {tWorkbook("cells.commandDynamic.questionNote")}
              </div>
            ) : (
              <>
                <input
                  data-testid="command-field"
                  aria-label={tWorkbook("cells.commandDynamic.fieldAria")}
                  list={fieldListId}
                  value={refPayload.ref.field}
                  onChange={(e) => updateRef({ field: e.target.value })}
                  placeholder={tWorkbook("cells.commandDynamic.fieldPlaceholder")}
                  className="border-input h-7 w-full rounded-md border bg-transparent px-2 font-mono text-xs"
                />
                <datalist id={fieldListId}>
                  {suggestions.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </>
            )}
          </div>

          {guidance ? (
            <p className="text-amber-600" data-testid="command-ref-issue">
              {guidance}
            </p>
          ) : null}
          {previewBlock}
        </div>
      </CellWrapper>
    );
  }

  // ── Static cell ────────────────────────────────────────────────────────────
  const nameOrContent = cell.payload.name?.trim() ? cell.payload.name : content;
  const displayName = nameOrContent.length > 0 ? nameOrContent : tWorkbook("cells.command");

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
      headerActions={
        <div className="flex items-center gap-1">
          {modeToggle}
          <DocsHelpLink
            iconOnly
            path="/guide/devices-protocols/commands"
            className="h-7 w-7 justify-center"
          />
          {!readOnly ? (
            <Select value={format} onValueChange={(v) => update({ format: v as CommandFormat })}>
              <SelectTrigger
                className="h-7 w-[90px] text-xs"
                aria-label={tWorkbook("cells.commandFormatAria")}
              >
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
            aria-label={tWorkbook("cells.commandCopyAria")}
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
