import type { WorkbookCell } from "../domains/workbook/workbook-cells.schema";

export interface CellPathSegment {
  containerCellId: string;
  laneId: string;
}

/** Root is `[]`; each segment enters one stable container/lane pair. */
export type CellPath = readonly CellPathSegment[];

export interface CellAddress {
  path: CellPath;
  cellId: string;
}

export interface CellLocation extends CellAddress {
  cell: WorkbookCell;
  index: number;
  body: WorkbookCell[];
}

export interface WorkbookCellTraversalOptions {
  /** Validation-only escape hatch so every duplicate can be diagnosed. */
  allowDuplicateIds?: boolean;
}

export class DuplicateWorkbookCellIdError extends Error {
  constructor(public readonly cellId: string) {
    super(`Duplicate workbook cell id "${cellId}"`);
    this.name = "DuplicateWorkbookCellIdError";
  }
}

export function cellPathKey(path: CellPath): string {
  return path.map(({ containerCellId, laneId }) => `${containerCellId}:${laneId}`).join("/");
}

export function sameCellPath(a: CellPath, b: CellPath): boolean {
  return (
    a.length === b.length &&
    a.every(
      (segment, index) =>
        segment.containerCellId === b[index]?.containerCellId &&
        segment.laneId === b[index]?.laneId,
    )
  );
}

/** Resolve a body by stable ids. Invalid paths resolve to undefined, never a sibling. */
export function workbookBodyAtPath(
  cells: WorkbookCell[],
  path: CellPath,
  options?: WorkbookCellTraversalOptions,
): WorkbookCell[] | undefined {
  assertUniqueCellIds(cells, options);
  let body = cells;
  for (const segment of path) {
    const container = body.find(
      (cell): cell is Extract<WorkbookCell, { type: "parallel" }> =>
        cell.id === segment.containerCellId && cell.type === "parallel",
    );
    const lane = container?.lanes.find((candidate) => candidate.id === segment.laneId);
    if (!lane) return undefined;
    body = lane.body;
  }
  return body;
}

/** Pre-order traversal. This is the sanctioned whole-workbook enumeration. */
export function walkWorkbookCells(
  cells: WorkbookCell[],
  options?: WorkbookCellTraversalOptions,
): CellLocation[] {
  const locations: CellLocation[] = [];
  const visit = (body: WorkbookCell[], path: CellPath) => {
    body.forEach((cell, index) => {
      locations.push({ cell, cellId: cell.id, index, body, path });
      if (cell.type !== "parallel") return;
      for (const lane of cell.lanes) {
        visit(lane.body, [...path, { containerCellId: cell.id, laneId: lane.id }]);
      }
    });
  };
  visit(cells, []);
  if (!options?.allowDuplicateIds) {
    const seen = new Set<string>();
    for (const { cell } of locations) {
      if (seen.has(cell.id)) throw new DuplicateWorkbookCellIdError(cell.id);
      seen.add(cell.id);
    }
  }
  return locations;
}

function assertUniqueCellIds(cells: WorkbookCell[], options?: WorkbookCellTraversalOptions): void {
  if (!options?.allowDuplicateIds) walkWorkbookCells(cells);
}

/** Stable-id lookup across the tree. Schema/runtime validation guarantees uniqueness. */
export function findWorkbookCell(cells: WorkbookCell[], cellId: string): CellLocation | undefined {
  return walkWorkbookCells(cells).find((location) => location.cell.id === cellId);
}

/** Lookup constrained to one body; never falls through to an ancestor or sibling. */
export function findWorkbookCellInBody(
  cells: WorkbookCell[],
  address: CellAddress,
  options?: WorkbookCellTraversalOptions,
): CellLocation | undefined {
  const body = workbookBodyAtPath(cells, address.path, options);
  if (!body) return undefined;
  const index = body.findIndex((cell) => cell.id === address.cellId);
  if (index < 0) return undefined;
  return { cell: body[index], cellId: address.cellId, index, body, path: address.path };
}

/**
 * Ordered cells visible to a data reference: each ancestor-body prefix before
 * its container, followed by the same-body prefix before the consumer. A
 * sibling lane, a later cell, and a container body viewed from root are absent.
 */
export function resolveCellScope(
  cells: WorkbookCell[],
  consumer: CellAddress,
  options?: WorkbookCellTraversalOptions,
): CellLocation[] {
  assertUniqueCellIds(cells, options);
  const visible: CellLocation[] = [];
  let body = cells;
  let currentPath: CellPath = [];

  for (const segment of consumer.path) {
    const containerIndex = body.findIndex(
      (cell) => cell.id === segment.containerCellId && cell.type === "parallel",
    );
    if (containerIndex < 0) return [];
    for (let index = 0; index < containerIndex; index++) {
      const cell = body[index];
      visible.push({ cell, cellId: cell.id, index, body, path: currentPath });
    }
    const container = body[containerIndex];
    if (container.type !== "parallel") return [];
    const lane = container.lanes.find((candidate) => candidate.id === segment.laneId);
    if (!lane) return [];
    currentPath = [...currentPath, segment];
    body = lane.body;
  }

  const consumerIndex = body.findIndex((cell) => cell.id === consumer.cellId);
  if (consumerIndex < 0) return [];
  for (let index = 0; index < consumerIndex; index++) {
    const cell = body[index];
    visible.push({ cell, cellId: cell.id, index, body, path: currentPath });
  }
  return visible;
}

/** Branch goto targets are restricted to the branch's own body. */
export function branchTargetCells(cells: WorkbookCell[], branch: CellAddress): WorkbookCell[] {
  const body = workbookBodyAtPath(cells, branch.path) ?? [];
  return body.filter((cell) => cell.id !== branch.cellId && cell.type !== "output");
}

/** Recursive immutable mapper/filter used by hydrators and host projections. */
export function mapWorkbookCellTree(
  cells: WorkbookCell[],
  map: (location: CellLocation) => WorkbookCell | null,
): WorkbookCell[] {
  assertUniqueCellIds(cells);
  const visit = (body: WorkbookCell[], path: CellPath): WorkbookCell[] =>
    body.flatMap((original, index) => {
      let cell: WorkbookCell = original;
      if (original.type === "parallel") {
        cell = {
          ...original,
          lanes: original.lanes.map((lane) => ({
            ...lane,
            body: visit(lane.body, [
              ...path,
              { containerCellId: original.id, laneId: lane.id },
            ]) as typeof lane.body,
          })),
        };
      }
      const mapped = map({ cell, cellId: cell.id, index, body, path });
      return mapped === null ? [] : [mapped];
    });
  return visit(cells, []);
}
