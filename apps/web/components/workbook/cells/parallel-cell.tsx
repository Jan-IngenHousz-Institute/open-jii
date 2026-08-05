"use client";

import { ArrowDown, ArrowUp, Layers3, Plus, Trash2 } from "lucide-react";

import type {
  BranchCell,
  ParallelBodyCell,
  ParallelCell,
  ParallelLane,
  WorkbookCell,
} from "@repo/api/domains/workbook/workbook-cells.schema";
import { resolveParallelDefaultLane } from "@repo/api/domains/workbook/workbook-cells.schema";
import type { EntitySnapshots } from "@repo/api/domains/workbook/workbook-version.schema";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";

import { AddCellButton } from "../add-cell-button";
import { nextBranchPathColor } from "../branch-path-colors";
import { CellRenderer } from "../cell-renderer";
import { CellWrapper } from "../cell-wrapper";
import { BranchCellComponent } from "./branch-cell";

interface ParallelCellProps {
  cell: ParallelCell;
  onUpdate: (cell: ParallelCell) => void;
  onDelete?: () => void;
  onRun?: () => void;
  allCells?: WorkbookCell[];
  executionStatus?: "idle" | "running" | "completed" | "error";
  executionError?: string;
  executionStates?: Record<
    string,
    {
      status: "idle" | "running" | "completed" | "error";
      error?: string;
      executionOrder?: number[];
    }
  >;
  promptedQuestionId?: string;
  onQuestionAnswered?: (answer: string) => void;
  readOnly?: boolean;
  entitySnapshots?: EntitySnapshots;
}

const NO_DEFAULT = "__no_default_lane__";
const INVALID_DEFAULT = "__invalid_default_lane__";
const laneOption = (index: number) => `lane:${index}`;

function createBodyCell(type: WorkbookCell["type"]): ParallelBodyCell {
  const id = crypto.randomUUID();
  const base = { id, isCollapsed: false };
  if (type === "markdown") return { ...base, type, content: "" };
  if (type === "command") {
    return { ...base, type, payload: { format: "string", content: "" } };
  }
  if (type === "branch") {
    const pathId = crypto.randomUUID();
    return {
      ...base,
      type,
      defaultPathId: pathId,
      paths: [
        {
          id: pathId,
          label: "Path 1",
          color: nextBranchPathColor([]),
          conditions: [
            {
              id: crypto.randomUUID(),
              sourceCellId: "",
              field: "",
              operator: "eq",
              value: "",
            },
          ],
        },
      ],
    };
  }
  throw new Error(`${type} cells must be created through their picker`);
}

function move<T>(items: T[], from: number, to: number): T[] {
  if (to < 0 || to >= items.length || from === to) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function ParallelCellComponent({
  cell,
  onUpdate,
  onDelete,
  onRun,
  allCells = [],
  executionStatus,
  executionError,
  executionStates,
  promptedQuestionId,
  onQuestionAnswered,
  readOnly,
  entitySnapshots,
}: ParallelCellProps) {
  const defaultResolution = resolveParallelDefaultLane(cell);
  const defaultLane = defaultResolution.kind === "resolved" ? defaultResolution.lane : undefined;
  const hasPromptedLaneQuestion =
    promptedQuestionId !== undefined &&
    cell.lanes.some((lane) => lane.body.some((bodyCell) => bodyCell.id === promptedQuestionId));

  const updateLane = (laneIndex: number, update: (lane: ParallelLane) => ParallelLane) => {
    onUpdate({
      ...cell,
      lanes: cell.lanes.map((lane, index) => (index === laneIndex ? update(lane) : lane)),
    });
  };

  const addLane = () => {
    const id = crypto.randomUUID();
    onUpdate({
      ...cell,
      defaultLaneId: cell.lanes.length === 0 && !cell.defaultLaneId ? id : cell.defaultLaneId,
      lanes: [
        ...cell.lanes,
        {
          id,
          label: `Lane ${cell.lanes.length + 1}`,
          color: nextBranchPathColor(cell.lanes),
          conditions: [],
          body: [],
        },
      ],
    });
  };

  const removeLane = (laneIndex: number) => {
    const removed = cell.lanes[laneIndex];
    const lanes = cell.lanes.filter((_, index) => index !== laneIndex);
    const removingResolvedDefault = removed === defaultLane;
    onUpdate({
      ...cell,
      lanes,
      defaultLaneId: removingResolvedDefault ? lanes[0]?.id : cell.defaultLaneId,
    });
  };

  return (
    <CellWrapper
      icon={<Layers3 className="h-3.5 w-3.5" />}
      label="Parallel"
      accentColor="#119DA4"
      isCollapsed={hasPromptedLaneQuestion ? false : cell.isCollapsed}
      onToggleCollapse={(isCollapsed) => onUpdate({ ...cell, isCollapsed })}
      onDelete={onDelete}
      onRun={() => onRun?.()}
      executionStatus={executionStatus}
      executionError={executionError}
      readOnly={readOnly}
      headerBadges={<span className="text-xs text-[#68737B]">{cell.lanes.length} lanes</span>}
    >
      <div className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-2">
          <Input
            aria-label="Container name"
            value={cell.name}
            onChange={(event) => onUpdate({ ...cell, name: event.target.value })}
            placeholder="Container name"
            disabled={readOnly}
          />
          <Select
            value={
              defaultLane
                ? laneOption(cell.lanes.indexOf(defaultLane))
                : cell.defaultLaneId
                  ? INVALID_DEFAULT
                  : NO_DEFAULT
            }
            onValueChange={(value) => {
              if (value === INVALID_DEFAULT) return;
              const index = Number(value.slice("lane:".length));
              onUpdate({
                ...cell,
                defaultLaneId: value === NO_DEFAULT ? undefined : cell.lanes[index]?.id,
              });
            }}
            disabled={readOnly}
          >
            <SelectTrigger aria-label="Default lane">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_DEFAULT}>No default</SelectItem>
              {cell.defaultLaneId && defaultResolution.kind !== "resolved" && (
                <SelectItem value={INVALID_DEFAULT}>
                  {defaultResolution.kind === "ambiguous" ? "Ambiguous" : "Missing"} lane (
                  {cell.defaultLaneId})
                </SelectItem>
              )}
              {cell.lanes.map((lane, index) => (
                <SelectItem key={`${lane.id}:${index}`} value={laneOption(index)}>
                  {lane.label || `Lane ${index + 1}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {cell.lanes.map((lane, laneIndex) => {
          const conditionCell: BranchCell = {
            id: cell.id,
            type: "branch",
            isCollapsed: false,
            paths: [
              {
                id: lane.id,
                label: lane.label,
                color: lane.color,
                conditions: lane.conditions,
              },
            ],
          };
          return (
            <section key={`${lane.id}:${laneIndex}`} className="space-y-3 rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <Input
                  aria-label={`Lane ${laneIndex + 1} label`}
                  value={lane.label}
                  onChange={(event) =>
                    updateLane(laneIndex, (current) => ({
                      ...current,
                      label: event.target.value,
                    }))
                  }
                  disabled={readOnly}
                />
                {!readOnly && (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Move ${lane.label || `Lane ${laneIndex + 1}`} up`}
                      disabled={laneIndex === 0}
                      onClick={() =>
                        onUpdate({ ...cell, lanes: move(cell.lanes, laneIndex, laneIndex - 1) })
                      }
                    >
                      <ArrowUp className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Move ${lane.label || `Lane ${laneIndex + 1}`} down`}
                      disabled={laneIndex === cell.lanes.length - 1}
                      onClick={() =>
                        onUpdate({ ...cell, lanes: move(cell.lanes, laneIndex, laneIndex + 1) })
                      }
                    >
                      <ArrowDown className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove ${lane.label || `Lane ${laneIndex + 1}`}`}
                      disabled={cell.lanes.length === 1}
                      onClick={() => removeLane(laneIndex)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </>
                )}
              </div>

              <BranchCellComponent
                cell={conditionCell}
                onUpdate={(updated) =>
                  updateLane(laneIndex, (current) => ({
                    ...current,
                    conditions: updated.paths[0]?.conditions ?? [],
                  }))
                }
                allCells={allCells}
                readOnly={readOnly}
                conditionsOnly
              />

              <div className="space-y-2 border-l-2 pl-3" style={{ borderColor: lane.color }}>
                {lane.body.map((bodyCell, bodyIndex) => (
                  <div key={`${bodyCell.id}:${bodyIndex}`} className="space-y-1">
                    {!readOnly && (
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={bodyIndex === 0}
                          onClick={() =>
                            updateLane(laneIndex, (current) => ({
                              ...current,
                              body: move(current.body, bodyIndex, bodyIndex - 1),
                            }))
                          }
                        >
                          <ArrowUp className="size-3" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={bodyIndex === lane.body.length - 1}
                          onClick={() =>
                            updateLane(laneIndex, (current) => ({
                              ...current,
                              body: move(current.body, bodyIndex, bodyIndex + 1),
                            }))
                          }
                        >
                          <ArrowDown className="size-3" />
                        </Button>
                      </div>
                    )}
                    <CellRenderer
                      cell={bodyCell}
                      onUpdate={(updated) =>
                        updateLane(laneIndex, (current) => ({
                          ...current,
                          body: current.body.map((candidate, index) =>
                            index === bodyIndex ? (updated as ParallelBodyCell) : candidate,
                          ),
                        }))
                      }
                      onDelete={() =>
                        updateLane(laneIndex, (current) => ({
                          ...current,
                          body: current.body.filter((_, index) => index !== bodyIndex),
                        }))
                      }
                      allCells={allCells}
                      executionStatus={executionStates?.[bodyCell.id]?.status}
                      executionError={executionStates?.[bodyCell.id]?.error}
                      executionStates={executionStates}
                      promptedQuestionId={promptedQuestionId}
                      onQuestionAnswered={onQuestionAnswered}
                      readOnly={readOnly}
                      entitySnapshots={entitySnapshots}
                    />
                  </div>
                ))}
                {!readOnly && (
                  <AddCellButton
                    onAdd={(type) =>
                      updateLane(laneIndex, (current) => ({
                        ...current,
                        body: [...current.body, createBodyCell(type)],
                      }))
                    }
                    onAddCell={(newCell) =>
                      updateLane(laneIndex, (current) => ({
                        ...current,
                        body: [...current.body, newCell as ParallelBodyCell],
                      }))
                    }
                    existingCells={allCells}
                    showParallel={false}
                    accentColor={lane.color}
                  />
                )}
              </div>
            </section>
          );
        })}

        {!readOnly && (
          <Button type="button" variant="outline" size="sm" onClick={addLane}>
            <Plus className="mr-1 size-4" /> Add lane
          </Button>
        )}
      </div>
    </CellWrapper>
  );
}
