"use client";

import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  ChevronRight,
  GitBranch,
  Plus,
  Route,
  X,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import type {
  BranchCell as BranchCellType,
  BranchCondition,
  BranchPath,
  WorkbookCell,
} from "@repo/api/domains/workbook/workbook-cells.schema";
import { DEVICE_CONTEXT_FIELDS, DEVICE_CONTEXT_KEY } from "@repo/api/transforms/device-context";
import {
  isGotoBranchCell,
  resolveBranchDefaultPath,
  resolveBranchEvaluatedPath,
  validateBranchCell,
  validateDeviceBranch,
} from "@repo/api/transforms/evaluate-branch";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@repo/ui/components/collapsible";
import { Input } from "@repo/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";

import { nextBranchPathColor } from "../branch-path-colors";
import { CellWrapper } from "../cell-wrapper";

interface BranchCellProps {
  cell: BranchCellType;
  onUpdate: (cell: BranchCellType) => void;
  onDelete?: () => void;
  onRun?: () => void;
  /** All cells in the workbook - used to populate source/target dropdowns */
  allCells?: WorkbookCell[];
  executionStatus?: "idle" | "running" | "completed" | "error";
  executionError?: string;
  readOnly?: boolean;
}

type BranchOperator = BranchCondition["operator"];

const NO_DEFAULT_PATH = "__no_default_path__";
const INVALID_DEFAULT_PATH = "__invalid_default_path__";
const pathOptionValue = (pathIndex: number) => `path:${pathIndex}`;

const operatorLabels: Record<BranchOperator, string> = {
  eq: "=",
  neq: "!=",
  gt: ">",
  lt: "<",
  gte: ">=",
  lte: "<=",
};

export function BranchCellComponent({
  cell: rawCell,
  onUpdate,
  onDelete,
  onRun,
  allCells,
  executionStatus,
  executionError,
  readOnly,
}: BranchCellProps) {
  const { t } = useTranslation("workbook");
  const cell = useMemo(
    () => (Array.isArray(rawCell.paths) ? rawCell : { ...rawCell, paths: [] as BranchPath[] }),
    [rawCell],
  );

  const [expandedPaths, setExpandedPaths] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    cell.paths.forEach((p, index) => {
      initial[`${p.id}:${index}`] = true;
    });
    return initial;
  });

  const sourceCells = useMemo(
    () =>
      (allCells ?? []).filter(
        (c) =>
          c.id !== cell.id &&
          (c.type === "protocol" ||
            c.type === "command" ||
            c.type === "macro" ||
            c.type === "question"),
      ),
    [allCells, cell.id],
  );

  const jumpTargets = useMemo(
    () => (allCells ?? []).filter((c) => c.id !== cell.id && c.type !== "output"),
    [allCells, cell.id],
  );

  const defaultPathResolution = useMemo(() => resolveBranchDefaultPath(cell), [cell]);
  const defaultPath =
    defaultPathResolution.status === "resolved" ? defaultPathResolution.path : undefined;
  const evaluatedPathResolution = useMemo(() => resolveBranchEvaluatedPath(cell), [cell]);
  const evaluatedPath =
    evaluatedPathResolution.status === "resolved" ? evaluatedPathResolution.path : undefined;

  const validationErrors = useMemo(
    () => [
      ...validateBranchCell(cell, { requireDefault: false }),
      ...validateDeviceBranch(cell, allCells ?? []),
    ],
    [allCells, cell],
  );

  const validationNotice =
    validationErrors.length > 0 ? (
      <div
        role="alert"
        className="border-destructive/30 bg-destructive/5 text-destructive flex gap-2 rounded-md border px-3 py-2 text-xs"
      >
        <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
        <ul className="space-y-0.5">
          {validationErrors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      </div>
    ) : null;

  const defaultWarning =
    cell.paths.length > 0 && defaultPathResolution.status !== "resolved" ? (
      <div
        role="status"
        className="flex gap-2 rounded-md border border-amber-300/50 bg-amber-50 px-3 py-2 text-xs text-amber-800"
      >
        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
        <span>{t("workbooks.problems.issue.branchNoDefault")}</span>
      </div>
    ) : null;

  const getFieldsForSource = useCallback(
    (sourceCellId: string): string[] => {
      // The connected device exposes a fixed field list from its identity.
      if (sourceCellId === DEVICE_CONTEXT_KEY) return [...DEVICE_CONTEXT_FIELDS];

      if (!allCells) return [];

      // Questions only expose a single implicit "answer" field.
      const sourceCell = allCells.find((c) => c.id === sourceCellId);
      if (sourceCell?.type === "question") return ["answer"];

      const outputCell = allCells.find((c) => c.type === "output" && c.producedBy === sourceCellId);
      if (outputCell?.type !== "output" || outputCell.data == null) return [];

      const data = outputCell.data;
      if (
        Array.isArray(data) &&
        data.length > 0 &&
        typeof data[0] === "object" &&
        data[0] !== null
      ) {
        return Object.keys(data[0] as Record<string, unknown>);
      }
      if (typeof data === "object") {
        return Object.keys(data);
      }
      return [];
    },
    [allCells],
  );

  const getCellLabel = useCallback((c: WorkbookCell): string => {
    try {
      switch (c.type) {
        case "protocol":
          return `Protocol (${c.payload.name ?? c.payload.protocolId.slice(0, 8)})`;
        case "command": {
          const source = c.payload.name?.trim() ? c.payload.name : c.payload.content.slice(0, 12);
          return `Command (${source.length > 0 ? source : "Empty"})`;
        }
        case "macro":
          return `Macro (${c.payload.name ?? c.payload.macroId.slice(0, 8)})`;
        case "question":
          return c.question.text ? `Q: ${c.question.text.slice(0, 30)}` : "Question";
        case "markdown":
          return c.content ? `MD: ${c.content.slice(0, 30)}` : "Markdown";
        case "branch":
          return "Branch";
        default:
          return c.type;
      }
    } catch {
      return c.type;
    }
  }, []);

  const handleAddPath = useCallback(() => {
    const pathId = crypto.randomUUID();
    const newPath: BranchPath = {
      id: pathId,
      label: `Path ${cell.paths.length + 1}`,
      color: nextBranchPathColor(cell.paths),
      conditions: [
        {
          id: crypto.randomUUID(),
          sourceCellId: "",
          field: "",
          operator: "eq",
          value: "",
        },
      ],
    };
    setExpandedPaths((prev) => ({ ...prev, [newPath.id]: true }));
    onUpdate({ ...cell, paths: [...cell.paths, newPath] });
  }, [cell, onUpdate]);

  const handleRemovePath = useCallback(
    (pathIndex: number) => {
      const removedPath = cell.paths[pathIndex];
      onUpdate({
        ...cell,
        paths: cell.paths.filter((_, index) => index !== pathIndex),
        defaultPathId: removedPath === defaultPath ? undefined : cell.defaultPathId,
      });
    },
    [cell, defaultPath, onUpdate],
  );

  const handleUpdatePath = useCallback(
    (pathIndex: number, updates: Partial<BranchPath>) => {
      onUpdate({
        ...cell,
        paths: cell.paths.map((path, index) =>
          index === pathIndex ? { ...path, ...updates } : path,
        ),
      });
    },
    [cell, onUpdate],
  );

  const handleConditionUpdate = useCallback(
    (pathIndex: number, condId: string, field: keyof BranchCondition, value: string) => {
      onUpdate({
        ...cell,
        paths: cell.paths.map((path, index) =>
          index === pathIndex
            ? {
                ...path,
                conditions: path.conditions.map((c) => {
                  if (c.id !== condId) return c;
                  const updated = { ...c, [field]: value };
                  if (field === "sourceCellId") {
                    const src = (allCells ?? []).find((ac) => ac.id === value);
                    if (value === DEVICE_CONTEXT_KEY) {
                      // Keep a still-valid device field on reselect; default to family.
                      if (!(DEVICE_CONTEXT_FIELDS as readonly string[]).includes(c.field)) {
                        updated.field = "family";
                      }
                    } else if (src?.type === "question") {
                      updated.field = "answer";
                    } else if (c.field === "answer") {
                      updated.field = "";
                    }
                  }
                  return updated;
                }),
              }
            : path,
        ),
      });
    },
    [cell, onUpdate, allCells],
  );

  const handleAddCondition = useCallback(
    (pathIndex: number) => {
      const newCond: BranchCondition = {
        id: crypto.randomUUID(),
        sourceCellId: "",
        field: "",
        operator: "eq",
        value: "",
      };
      onUpdate({
        ...cell,
        paths: cell.paths.map((path, index) =>
          index === pathIndex ? { ...path, conditions: [...path.conditions, newCond] } : path,
        ),
      });
    },
    [cell, onUpdate],
  );

  const handleRemoveCondition = useCallback(
    (pathIndex: number, condId: string) => {
      onUpdate({
        ...cell,
        paths: cell.paths.map((path, index) =>
          index === pathIndex
            ? { ...path, conditions: path.conditions.filter((c) => c.id !== condId) }
            : path,
        ),
      });
    },
    [cell, onUpdate],
  );

  const togglePathExpanded = (pathKey: string) => {
    setExpandedPaths((prev) => ({ ...prev, [pathKey]: !prev[pathKey] }));
  };

  if (isGotoBranchCell(cell)) {
    const path = cell.paths[0];
    const targetExists = jumpTargets.some((target) => target.id === path.gotoCellId);

    return (
      <CellWrapper
        icon={<ArrowRight className="h-3.5 w-3.5" />}
        label="Go to"
        accentColor="#F29D38"
        isCollapsed={cell.isCollapsed}
        onToggleCollapse={(collapsed) => onUpdate({ ...cell, isCollapsed: collapsed })}
        onDelete={onDelete}
        executionStatus={executionStatus}
        executionError={executionError}
        readOnly={readOnly}
        onRun={() => onRun?.()}
      >
        <div className="space-y-2">
          {validationNotice}
          <div className="flex items-center gap-2">
            <ArrowRight className="text-muted-foreground size-4 shrink-0" />
            <Select
              value={path.gotoCellId ?? undefined}
              onValueChange={(gotoCellId) => handleUpdatePath(0, { gotoCellId })}
              disabled={readOnly}
            >
              <SelectTrigger aria-label="Go to target" className="h-8 flex-1 text-xs">
                <SelectValue placeholder="Choose target cell..." />
              </SelectTrigger>
              <SelectContent>
                {path.gotoCellId && !targetExists && (
                  <SelectItem value={path.gotoCellId} className="text-xs">
                    Missing cell ({path.gotoCellId})
                  </SelectItem>
                )}
                {jumpTargets.map((target) => (
                  <SelectItem key={target.id} value={target.id} className="text-xs">
                    {getCellLabel(target)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!readOnly && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 shrink-0 text-xs"
                onClick={() =>
                  handleUpdatePath(0, {
                    conditions: [
                      {
                        id: crypto.randomUUID(),
                        sourceCellId: "",
                        field: "",
                        operator: "eq",
                        value: "",
                      },
                    ],
                  })
                }
              >
                Convert to branch
              </Button>
            )}
          </div>
        </div>
      </CellWrapper>
    );
  }

  const renderCondition = (
    path: BranchPath,
    pathIndex: number,
    cond: BranchCondition,
    conditionIndex: number,
  ) => {
    const fields = getFieldsForSource(cond.sourceCellId);
    const sourceCell = (allCells ?? []).find((c) => c.id === cond.sourceCellId);
    const isQuestionSource = sourceCell?.type === "question";
    const sourceExists =
      cond.sourceCellId === DEVICE_CONTEXT_KEY ||
      sourceCells.some((c) => c.id === cond.sourceCellId);

    return (
      <div key={cond.id} className="group/cond flex items-center gap-1.5">
        <span className="w-7 shrink-0 text-right text-xs font-semibold uppercase text-orange-600/80 dark:text-orange-400/80">
          {conditionIndex === 0 ? "If" : "And"}
        </span>

        <Select
          value={cond.sourceCellId || undefined}
          onValueChange={(v) => handleConditionUpdate(pathIndex, cond.id, "sourceCellId", v)}
          disabled={readOnly}
        >
          <SelectTrigger aria-label="Source cell" className="h-7 min-w-[100px] flex-1 text-xs">
            <SelectValue placeholder="source..." />
          </SelectTrigger>
          <SelectContent>
            {cond.sourceCellId && !sourceExists && (
              <SelectItem value={cond.sourceCellId} className="text-xs">
                Missing cell ({cond.sourceCellId})
              </SelectItem>
            )}
            <SelectItem value={DEVICE_CONTEXT_KEY} className="text-xs font-medium">
              Connected device
            </SelectItem>
            {sourceCells.map((sc) => (
              <SelectItem key={sc.id} value={sc.id} className="text-xs">
                {getCellLabel(sc)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {isQuestionSource ? (
          <span className="bg-muted text-muted-foreground flex h-7 min-w-[80px] flex-1 items-center rounded-md border px-2 text-xs">
            answer
          </span>
        ) : fields.length > 0 ? (
          <Select
            value={cond.field || undefined}
            onValueChange={(v) => handleConditionUpdate(pathIndex, cond.id, "field", v)}
            disabled={readOnly}
          >
            <SelectTrigger className="h-7 min-w-[80px] flex-1 text-xs">
              <SelectValue placeholder="field" />
            </SelectTrigger>
            <SelectContent>
              {fields.map((f) => (
                <SelectItem key={f} value={f} className="text-xs">
                  {f}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input
            value={cond.field}
            onChange={(e) => handleConditionUpdate(pathIndex, cond.id, "field", e.target.value)}
            placeholder="field"
            className="h-7 min-w-[80px] flex-1 border-dashed bg-transparent text-xs"
            disabled={readOnly}
          />
        )}

        <Select
          value={cond.operator}
          onValueChange={(v) => handleConditionUpdate(pathIndex, cond.id, "operator", v)}
          disabled={readOnly}
        >
          <SelectTrigger className="h-7 w-16 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.entries(operatorLabels) as [BranchOperator, string][]).map(([op, label]) => (
              <SelectItem key={op} value={op} className="text-xs">
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          value={cond.value}
          onChange={(e) => handleConditionUpdate(pathIndex, cond.id, "value", e.target.value)}
          placeholder="value"
          className="h-7 min-w-[60px] flex-1 border-dashed bg-transparent text-xs"
          disabled={readOnly}
        />

        {!readOnly && (path.conditions.length > 1 || path === defaultPath) ? (
          <Button
            variant="ghost"
            size="sm"
            aria-label="Remove condition"
            className="text-muted-foreground hover:text-destructive h-6 w-6 shrink-0 p-0 opacity-0 transition-opacity group-hover/cond:opacity-100"
            onClick={() => handleRemoveCondition(pathIndex, cond.id)}
          >
            <X className="h-3 w-3" />
          </Button>
        ) : (
          <div className="w-6 shrink-0" />
        )}
      </div>
    );
  };

  const renderPath = (path: BranchPath, pathIndex: number) => {
    const pathKey = `${path.id}:${pathIndex}`;
    const isExpanded = expandedPaths[pathKey] ?? true;
    const isEvaluated = path === evaluatedPath;
    const targetExists = jumpTargets.some((target) => target.id === path.gotoCellId);

    return (
      <div className="relative">
        <Collapsible open={isExpanded} onOpenChange={() => togglePathExpanded(pathKey)}>
          <div className="flex items-center gap-1">
            <CollapsibleTrigger asChild>
              <button
                className={`hover:bg-muted/50 flex flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors ${
                  isEvaluated ? "bg-green-50 dark:bg-green-950/30" : ""
                }`}
              >
                <Route className="text-muted-foreground size-4 shrink-0" />

                <Input
                  value={path.label}
                  onChange={(e) => handleUpdatePath(pathIndex, { label: e.target.value })}
                  onClick={(e) => e.stopPropagation()}
                  className="hover:border-border focus:border-border h-6 flex-1 border-transparent bg-transparent px-1.5 text-sm font-medium"
                  disabled={readOnly}
                />

                {isEvaluated && (
                  <span className="shrink-0 rounded bg-green-500 px-1.5 py-0.5 text-xs font-semibold text-white">
                    ACTIVE
                  </span>
                )}

                <ChevronRight
                  className={`text-muted-foreground size-4 transition-transform ${
                    isExpanded ? "rotate-90" : ""
                  }`}
                />
              </button>
            </CollapsibleTrigger>

            {!readOnly && cell.paths.length > 1 && (
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Remove ${path.label || `Path ${pathIndex + 1}`}`}
                className="text-muted-foreground hover:text-destructive h-6 w-6 p-0 opacity-0 transition-opacity group-hover/path:opacity-100"
                onClick={() => handleRemovePath(pathIndex)}
              >
                <X className="size-3.5" />
              </Button>
            )}
          </div>

          <CollapsibleContent>
            <div className="border-border/60 ml-6 border-l pl-4 pt-2">
              <div className="border-border/60 overflow-hidden rounded-md border bg-orange-50/30 dark:bg-orange-950/10">
                <div className="space-y-1.5 p-2.5">
                  {path.conditions.map((cond, conditionIndex) =>
                    renderCondition(path, pathIndex, cond, conditionIndex),
                  )}
                  {!readOnly && (
                    <div className="pl-[34px]">
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs"
                        onClick={() => handleAddCondition(pathIndex)}
                      >
                        <Plus className="size-3" /> condition
                      </button>
                    </div>
                  )}
                </div>

                <div className="border-border/40 bg-background/50 flex items-center gap-2 border-t px-2.5 py-2">
                  <span className="text-muted-foreground w-7 shrink-0 text-right text-xs font-semibold uppercase">
                    Then
                  </span>
                  <ArrowRight className="text-muted-foreground size-3 shrink-0" />
                  <Select
                    value={path.gotoCellId ?? undefined}
                    onValueChange={(v) => handleUpdatePath(pathIndex, { gotoCellId: v })}
                    disabled={readOnly}
                  >
                    <SelectTrigger aria-label="Jump to cell" className="h-7 text-xs">
                      <SelectValue placeholder="Jump to cell..." />
                    </SelectTrigger>
                    <SelectContent>
                      {path.gotoCellId && !targetExists && (
                        <SelectItem value={path.gotoCellId} className="text-xs">
                          Missing cell ({path.gotoCellId})
                        </SelectItem>
                      )}
                      {jumpTargets.map((t) => (
                        <SelectItem key={t.id} value={t.id} className="text-xs">
                          {getCellLabel(t)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    );
  };

  return (
    <CellWrapper
      icon={<GitBranch className="h-3.5 w-3.5" />}
      label="Branch"
      accentColor="#F29D38"
      isCollapsed={cell.isCollapsed}
      onToggleCollapse={(collapsed) => onUpdate({ ...cell, isCollapsed: collapsed })}
      onDelete={onDelete}
      executionStatus={executionStatus}
      executionError={executionError}
      readOnly={readOnly}
      headerBadges={
        <span className="text-xs font-normal text-[#68737B]">
          {cell.paths.length} path{cell.paths.length !== 1 ? "s" : ""}
        </span>
      }
      onRun={() => onRun?.()}
    >
      <div className="space-y-2">
        {validationNotice}
        {defaultWarning}
        <div className="border-border/60 bg-muted/20 flex items-center gap-2 rounded-md border px-2.5 py-2">
          <span className="text-muted-foreground shrink-0 text-xs font-semibold">Otherwise</span>
          <Select
            value={
              defaultPath
                ? pathOptionValue(cell.paths.indexOf(defaultPath))
                : cell.defaultPathId
                  ? INVALID_DEFAULT_PATH
                  : NO_DEFAULT_PATH
            }
            onValueChange={(value) => {
              if (value === INVALID_DEFAULT_PATH) return;
              const pathIndex = Number(value.slice("path:".length));
              onUpdate({
                ...cell,
                defaultPathId: value === NO_DEFAULT_PATH ? undefined : cell.paths[pathIndex]?.id,
              });
            }}
            disabled={readOnly}
          >
            <SelectTrigger aria-label="Otherwise path" className="h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_DEFAULT_PATH} className="text-xs">
                No default (fall through)
              </SelectItem>
              {cell.defaultPathId && defaultPathResolution.status !== "resolved" && (
                <SelectItem value={INVALID_DEFAULT_PATH} className="text-xs">
                  {defaultPathResolution.status === "ambiguous" ? "Ambiguous" : "Missing"} path (
                  {cell.defaultPathId})
                </SelectItem>
              )}
              {cell.paths.map((path, index) => (
                <SelectItem
                  key={`${path.id}:${index}`}
                  value={pathOptionValue(index)}
                  className="text-xs"
                >
                  {path.label || `Path ${index + 1}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          {cell.paths.map((path, index) => (
            <div key={`${path.id}:${index}`} className="group/path">
              {renderPath(path, index)}
            </div>
          ))}

          {!readOnly && (
            <button
              type="button"
              className="text-muted-foreground hover:bg-muted/50 hover:text-foreground flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors"
              onClick={handleAddPath}
            >
              <Plus className="size-3.5" />
              Add path
            </button>
          )}
        </div>
      </div>
    </CellWrapper>
  );
}
