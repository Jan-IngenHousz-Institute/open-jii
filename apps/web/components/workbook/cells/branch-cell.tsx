"use client";

import { ArrowRight, ChevronRight, GitBranch, Plus, Route, X } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import type {
  BranchCell as BranchCellType,
  BranchCondition,
  BranchPath,
  WorkbookCell,
} from "@repo/api";
import { Badge } from "@repo/ui/components/badge";
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

import { CellWrapper } from "../cell-wrapper";

interface BranchCellProps {
  cell: BranchCellType;
  onUpdate: (cell: BranchCellType) => void;
  onDelete: () => void;
  onRun?: () => void;
  /** All cells in the workbook - used to populate source/target dropdowns */
  allCells?: WorkbookCell[];
  executionStatus?: "idle" | "running" | "completed" | "error";
  executionError?: string;
  readOnly?: boolean;
}

type BranchOperator = BranchCondition["operator"];

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
  const cell = useMemo(
    () => (Array.isArray(rawCell.paths) ? rawCell : { ...rawCell, paths: [] as BranchPath[] }),
    [rawCell],
  );

  const [expandedPaths, setExpandedPaths] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    cell.paths.forEach((p) => {
      initial[p.id] = true;
    });
    return initial;
  });

  // Filter to cells that can produce output data
  const sourceCells = useMemo(
    () =>
      (allCells ?? []).filter(
        (c) =>
          c.id !== cell.id &&
          (c.type === "protocol" || c.type === "macro" || c.type === "question"),
      ),
    [allCells, cell.id],
  );

  // Filter to cells that can be jumped to
  const jumpTargets = useMemo(
    () => (allCells ?? []).filter((c) => c.id !== cell.id && c.type !== "output"),
    [allCells, cell.id],
  );

  // Discover field names from the output cell produced by a given source cell
  const getFieldsForSource = useCallback(
    (sourceCellId: string): string[] => {
      if (!allCells) return [];

      // Question cells have a single implicit field: the answer
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
        return Object.keys(data as Record<string, unknown>);
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

  // --- Path handlers ---

  const handleAddPath = useCallback(() => {
    const newPath: BranchPath = {
      id: crypto.randomUUID(),
      label: `Path ${cell.paths.length + 1}`,
      color: "",
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
    (pathId: string) => {
      onUpdate({ ...cell, paths: cell.paths.filter((p) => p.id !== pathId) });
    },
    [cell, onUpdate],
  );

  const handleUpdatePath = useCallback(
    (pathId: string, updates: Partial<BranchPath>) => {
      onUpdate({
        ...cell,
        paths: cell.paths.map((p) => (p.id === pathId ? { ...p, ...updates } : p)),
      });
    },
    [cell, onUpdate],
  );

  // --- Condition handlers ---

  const handleConditionUpdate = useCallback(
    (pathId: string, condId: string, field: keyof BranchCondition, value: string) => {
      onUpdate({
        ...cell,
        paths: cell.paths.map((p) =>
          p.id === pathId
            ? {
                ...p,
                conditions: p.conditions.map((c) => {
                  if (c.id !== condId) return c;
                  const updated = { ...c, [field]: value };
                  // When switching source to a question cell, auto-set field to "answer"
                  if (field === "sourceCellId") {
                    const src = (allCells ?? []).find((ac) => ac.id === value);
                    if (src?.type === "question") {
                      updated.field = "answer";
                    } else if (c.field === "answer") {
                      updated.field = "";
                    }
                  }
                  return updated;
                }),
              }
            : p,
        ),
      });
    },
    [cell, onUpdate, allCells],
  );

  const handleAddCondition = useCallback(
    (pathId: string) => {
      const newCond: BranchCondition = {
        id: crypto.randomUUID(),
        sourceCellId: "",
        field: "",
        operator: "eq",
        value: "",
      };
      onUpdate({
        ...cell,
        paths: cell.paths.map((p) =>
          p.id === pathId ? { ...p, conditions: [...p.conditions, newCond] } : p,
        ),
      });
    },
    [cell, onUpdate],
  );

  const handleRemoveCondition = useCallback(
    (pathId: string, condId: string) => {
      onUpdate({
        ...cell,
        paths: cell.paths.map((p) =>
          p.id === pathId ? { ...p, conditions: p.conditions.filter((c) => c.id !== condId) } : p,
        ),
      });
    },
    [cell, onUpdate],
  );

  const togglePathExpanded = (pathId: string) => {
    setExpandedPaths((prev) => ({ ...prev, [pathId]: !prev[pathId] }));
  };

  // Render a single condition row
  const renderCondition = (path: BranchPath, cond: BranchCondition, index: number) => {
    const fields = getFieldsForSource(cond.sourceCellId);
    const sourceCell = (allCells ?? []).find((c) => c.id === cond.sourceCellId);
    const isQuestionSource = sourceCell?.type === "question";

    return (
      <div key={cond.id} className="group/cond flex items-center gap-1.5">
        {/* Row label: first row says IF, subsequent say AND */}
        <span className="w-7 shrink-0 text-right text-xs font-semibold uppercase text-orange-600/80 dark:text-orange-400/80">
          {index === 0 ? "If" : "And"}
        </span>

        {/* Source cell */}
        <Select
          value={cond.sourceCellId || undefined}
          onValueChange={(v) => handleConditionUpdate(path.id, cond.id, "sourceCellId", v)}
          disabled={readOnly}
        >
          <SelectTrigger className="h-7 min-w-[100px] flex-1 text-xs">
            <SelectValue placeholder="source..." />
          </SelectTrigger>
          <SelectContent>
            {sourceCells.map((sc) => (
              <SelectItem key={sc.id} value={sc.id} className="text-xs">
                {getCellLabel(sc)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Field */}
        {isQuestionSource ? (
          <span className="bg-muted text-muted-foreground flex h-7 min-w-[80px] flex-1 items-center rounded-md border px-2 text-xs">
            answer
          </span>
        ) : fields.length > 0 ? (
          <Select
            value={cond.field || undefined}
            onValueChange={(v) => handleConditionUpdate(path.id, cond.id, "field", v)}
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
            onChange={(e) => handleConditionUpdate(path.id, cond.id, "field", e.target.value)}
            placeholder="field"
            className="h-7 min-w-[80px] flex-1 border-dashed bg-transparent text-xs"
            disabled={readOnly}
          />
        )}

        {/* Operator */}
        <Select
          value={cond.operator}
          onValueChange={(v) => handleConditionUpdate(path.id, cond.id, "operator", v)}
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

        {/* Value */}
        <Input
          value={cond.value}
          onChange={(e) => handleConditionUpdate(path.id, cond.id, "value", e.target.value)}
          placeholder="value"
          className="h-7 min-w-[60px] flex-1 border-dashed bg-transparent text-xs"
          disabled={readOnly}
        />

        {/* Remove condition - hover only */}
        {!readOnly && path.conditions.length > 1 ? (
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-destructive h-6 w-6 shrink-0 p-0 opacity-0 transition-opacity group-hover/cond:opacity-100"
            onClick={() => handleRemoveCondition(path.id, cond.id)}
          >
            <X className="h-3 w-3" />
          </Button>
        ) : (
          <div className="w-6 shrink-0" />
        )}
      </div>
    );
  };

  // Render a single path folder
  const renderPath = (path: BranchPath) => {
    const isExpanded = expandedPaths[path.id] ?? true;
    const isEvaluated = cell.evaluatedPathId === path.id;

    return (
      <div key={path.id} className="relative">
        <Collapsible open={isExpanded} onOpenChange={() => togglePathExpanded(path.id)}>
          {/* Path header */}
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
                  onChange={(e) => handleUpdatePath(path.id, { label: e.target.value })}
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
                className="text-muted-foreground hover:text-destructive h-6 w-6 p-0 opacity-0 transition-opacity group-hover/path:opacity-100"
                onClick={() => handleRemovePath(path.id)}
              >
                <X className="size-3.5" />
              </Button>
            )}
          </div>

          <CollapsibleContent>
            <div className="border-border/60 ml-6 border-l pl-4 pt-2">
              <div className="border-border/60 overflow-hidden rounded-md border bg-orange-50/30 dark:bg-orange-950/10">
                {/* Conditions */}
                <div className="space-y-1.5 p-2.5">
                  {path.conditions.map((cond, index) => renderCondition(path, cond, index))}
                  {!readOnly && (
                    <div className="pl-[34px]">
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs"
                        onClick={() => handleAddCondition(path.id)}
                      >
                        <Plus className="size-3" /> condition
                      </button>
                    </div>
                  )}
                </div>

                {/* Then -> jump to target */}
                <div className="border-border/40 bg-background/50 flex items-center gap-2 border-t px-2.5 py-2">
                  <span className="text-muted-foreground w-7 shrink-0 text-right text-xs font-semibold uppercase">
                    Then
                  </span>
                  <ArrowRight className="text-muted-foreground size-3 shrink-0" />
                  <Select
                    value={path.gotoCellId ?? undefined}
                    onValueChange={(v) => handleUpdatePath(path.id, { gotoCellId: v })}
                    disabled={readOnly}
                  >
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue placeholder="Jump to cell..." />
                    </SelectTrigger>
                    <SelectContent>
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
        <Badge variant="outline" className="text-xs">
          {cell.paths.length} path{cell.paths.length !== 1 ? "s" : ""}
        </Badge>
      }
      onRun={() => onRun?.()}
    >
      <div className="space-y-1">
        {cell.paths.map((path) => (
          <div key={path.id} className="group/path">
            {renderPath(path)}
          </div>
        ))}

        {/* Add path button */}
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
    </CellWrapper>
  );
}
