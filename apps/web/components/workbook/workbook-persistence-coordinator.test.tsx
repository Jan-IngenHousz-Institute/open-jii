import { act, renderHook } from "@/test/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { WorkbookCell } from "@repo/api/domains/workbook/workbook-cells.schema";

import {
  PersistenceScopeChangedError,
  useWorkbookPersistenceCoordinator,
} from "./workbook-persistence-coordinator";

const mutations = vi.hoisted(() => ({
  update: vi.fn(),
  upgrade: vi.fn(),
  attach: vi.fn(),
  detach: vi.fn(),
  setVersion: vi.fn(),
}));

vi.mock("@/hooks/workbook/useWorkbookUpdate/useWorkbookUpdate", () => ({
  useWorkbookUpdate: () => ({ mutateAsync: mutations.update }),
}));
vi.mock("@/hooks/experiment/useUpgradeWorkbookVersion/useUpgradeWorkbookVersion", () => ({
  useUpgradeWorkbookVersion: () => ({ mutateAsync: mutations.upgrade }),
}));
vi.mock("@/hooks/experiment/useAttachWorkbook/useAttachWorkbook", () => ({
  useAttachWorkbook: () => ({ mutateAsync: mutations.attach }),
}));
vi.mock("@/hooks/experiment/useDetachWorkbook/useDetachWorkbook", () => ({
  useDetachWorkbook: () => ({ mutateAsync: mutations.detach }),
}));
vi.mock("@/hooks/experiment/useSetWorkbookVersion/useSetWorkbookVersion", () => ({
  useSetWorkbookVersion: () => ({ mutateAsync: mutations.setVersion }),
}));

const cell = (id: string, content = id): Extract<WorkbookCell, { type: "markdown" }> => ({
  id,
  type: "markdown",
  isCollapsed: false,
  content,
});

const container = (id: string, name: string): WorkbookCell => ({
  id,
  type: "parallel",
  isCollapsed: false,
  name,
  defaultLaneId: `${id}-lane`,
  lanes: [
    {
      id: `${id}-lane`,
      label: "Lane",
      color: "#64748b",
      conditions: [],
      body: [cell(`${id}-body`)],
    },
  ],
});

const invalidIdentityDrafts: [string, WorkbookCell[]][] = [
  ["duplicate cell ids", [cell("shared", "First"), cell("shared", "Second")]],
  [
    "canonical container-name collisions",
    [container("parallel-a", "plot id"), container("parallel-b", "plot-id")],
  ],
];

interface HarnessProps {
  workbookId: string;
  cells: WorkbookCell[];
  persistedCells?: WorkbookCell[];
  enabled?: boolean;
  baselineLoaded?: boolean;
}

const renderCoordinator = (initialProps: HarnessProps) => {
  const persistedByWorkbook = new Map([[initialProps.workbookId, initialProps.cells]]);
  const persistedCells = (workbookId: string, cells: WorkbookCell[]) => {
    const existing = persistedByWorkbook.get(workbookId);
    if (existing) return existing;
    persistedByWorkbook.set(workbookId, cells);
    return cells;
  };
  return renderHook(
    ({
      workbookId,
      cells,
      persistedCells: persistedCellsProp,
      enabled = true,
      baselineLoaded = true,
    }: HarnessProps) =>
      useWorkbookPersistenceCoordinator({
        experimentId: "experiment-1",
        workbookId,
        workbookVersionId: workbookId ? `version-${workbookId}` : "",
        cells,
        persistedCells: baselineLoaded
          ? (persistedCellsProp ?? persistedCells(workbookId, cells))
          : undefined,
        enabled,
        delayMs: 20,
      }),
    { initialProps },
  );
};

describe("useWorkbookPersistenceCoordinator", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mutations.update.mockImplementation(({ id }: { id: string }) => Promise.resolve({ id }));
    mutations.upgrade.mockResolvedValue({ workbookVersionId: "version-next" });
    mutations.attach.mockResolvedValue({ workbookVersionId: "version-attached" });
    mutations.detach.mockResolvedValue(undefined);
    mutations.setVersion.mockResolvedValue({ workbookVersionId: "version-restored" });
  });

  afterEach(() => vi.useRealTimers());

  it("does not save when a disabled cold scope receives its server baseline before activation", async () => {
    const { result, rerender } = renderCoordinator({
      workbookId: "workbook-a",
      cells: [],
      baselineLoaded: false,
      enabled: false,
    });

    rerender({
      workbookId: "workbook-a",
      cells: [cell("server-a0")],
      persistedCells: [cell("server-a0")],
      enabled: false,
    });
    rerender({
      workbookId: "workbook-a",
      cells: [cell("server-a0")],
      persistedCells: [cell("server-a0")],
      enabled: true,
    });

    await act(async () => vi.advanceTimersByTimeAsync(30));

    expect(result.current.autosave.status).toBe("idle");
    expect(result.current.autosave.hasUnsavedChanges).toBe(false);
    expect(mutations.update).not.toHaveBeenCalled();
    expect(mutations.upgrade).not.toHaveBeenCalled();
  });

  it("serializes a cells write and its pin before an entity pin and attachment", async () => {
    let releaseUpdate: (() => void) | undefined;
    mutations.update.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          releaseUpdate = () => resolve({ id: "workbook-a" });
        }),
    );
    const { result, rerender } = renderCoordinator({
      workbookId: "workbook-a",
      cells: [cell("a0")],
    });

    rerender({ workbookId: "workbook-a", cells: [cell("a1")] });
    await act(async () => vi.advanceTimersByTimeAsync(30));
    const entityPromise = result.current.entitySaved();
    let releaseAttach: (() => void) | undefined;
    mutations.attach.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          releaseAttach = () => resolve({ workbookVersionId: "version-attached" });
        }),
    );
    const attachPromise = result.current.attachWorkbook("workbook-b");

    expect(mutations.update).toHaveBeenCalledTimes(1);
    expect(mutations.upgrade).not.toHaveBeenCalled();
    expect(mutations.attach).not.toHaveBeenCalled();

    await act(async () => {
      releaseUpdate?.();
      await entityPromise;
    });
    expect(mutations.attach).toHaveBeenCalledTimes(1);
    rerender({ workbookId: "workbook-b", cells: [cell("b0")] });
    await act(async () => {
      releaseAttach?.();
      await attachPromise;
    });

    expect(mutations.upgrade).toHaveBeenCalledTimes(2);
    expect(mutations.attach).toHaveBeenCalledWith({
      id: "experiment-1",
      workbookId: "workbook-b",
      expectedWorkbookId: "workbook-a",
      expectedWorkbookVersionId: "version-next",
    });
    expect(mutations.update.mock.invocationCallOrder[0]).toBeLessThan(
      mutations.upgrade.mock.invocationCallOrder[0],
    );
    expect(mutations.upgrade.mock.invocationCallOrder[1]).toBeLessThan(
      mutations.attach.mock.invocationCallOrder[0],
    );
  });

  it("retries a failed cells pin without repeating the successful workbook write", async () => {
    const failure = new Error("pin failed");
    mutations.upgrade
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce({ workbookVersionId: "version-next" });
    const { result, rerender } = renderCoordinator({
      workbookId: "workbook-a",
      cells: [cell("a0")],
    });

    rerender({ workbookId: "workbook-a", cells: [cell("a1")] });
    await act(async () => vi.advanceTimersByTimeAsync(30));
    expect(result.current.autosave.status).toBe("error");
    expect(result.current.autosave.error).toBe(failure);

    await act(async () => result.current.autosave.flush());

    expect(mutations.update).toHaveBeenCalledTimes(1);
    expect(mutations.upgrade).toHaveBeenCalledTimes(2);
    expect(result.current.autosave.status).toBe("idle");
  });

  it("makes an old workbook completion inert after the scope key changes", async () => {
    let releaseOldUpdate: (() => void) | undefined;
    mutations.update.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          releaseOldUpdate = () => resolve({ id: "workbook-a" });
        }),
    );
    const { result, rerender } = renderCoordinator({
      workbookId: "workbook-a",
      cells: [cell("a0")],
    });

    rerender({ workbookId: "workbook-a", cells: [cell("a1")] });
    await act(async () => vi.advanceTimersByTimeAsync(30));
    expect(mutations.update).toHaveBeenCalledWith({
      id: "workbook-a",
      cells: [cell("a1")],
    });

    rerender({ workbookId: "workbook-b", cells: [cell("b0")] });
    await act(async () => {
      releaseOldUpdate?.();
      await result.current.autosave.flush();
    });
    expect(mutations.upgrade).not.toHaveBeenCalled();
    expect(result.current.autosave.status).toBe("idle");

    rerender({ workbookId: "workbook-b", cells: [cell("b1")] });
    await act(async () => vi.advanceTimersByTimeAsync(30));
    expect(result.current.autosave.status).toBe("idle");

    expect(mutations.update).toHaveBeenLastCalledWith({
      id: "workbook-b",
      cells: [cell("b1")],
    });
    expect(mutations.upgrade).toHaveBeenCalledTimes(1);
  });

  it("does not replay a failed pin ahead of different queued work", async () => {
    let rejectPin: ((error: Error) => void) | undefined;
    const failure = new Error("pin failed");
    mutations.upgrade.mockImplementationOnce(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectPin = reject;
        }),
    );
    const { result, rerender } = renderCoordinator({
      workbookId: "workbook-a",
      cells: [cell("a0")],
    });

    rerender({ workbookId: "workbook-a", cells: [cell("a1")] });
    await act(async () => vi.advanceTimersByTimeAsync(30));
    const queuedEntity = result.current.entitySaved();
    act(() => rejectPin?.(failure));

    await expect(queuedEntity).resolves.toBeUndefined();
    expect(mutations.upgrade).toHaveBeenCalledTimes(2);

    mutations.upgrade.mockResolvedValue({ workbookVersionId: "version-next" });
    await act(async () => result.current.autosave.flush());
    expect(mutations.update).toHaveBeenCalledTimes(1);
    expect(mutations.upgrade).toHaveBeenCalledTimes(3);
  });

  it("does not replay a failed attachment before a later cells edit", async () => {
    const failure = new Error("attach failed");
    mutations.attach.mockRejectedValueOnce(failure);
    const { result, rerender } = renderCoordinator({
      workbookId: "workbook-a",
      cells: [cell("a0")],
    });

    await expect(result.current.attachWorkbook("workbook-b")).rejects.toBe(failure);

    rerender({ workbookId: "workbook-a", cells: [cell("a1")] });
    await act(async () => vi.advanceTimersByTimeAsync(30));

    expect(mutations.attach).toHaveBeenCalledTimes(1);
    expect(mutations.update).toHaveBeenCalledWith({
      id: "workbook-a",
      cells: [cell("a1")],
    });
    expect(mutations.upgrade).toHaveBeenCalledWith({
      id: "experiment-1",
      expectedWorkbookId: "workbook-a",
      expectedWorkbookVersionId: "version-workbook-a",
    });
  });

  it("lets a different attachment supersede a failed one and follows the successful rerender", async () => {
    const failure = new Error("attach B failed");
    mutations.attach.mockRejectedValueOnce(failure);
    const { result, rerender } = renderCoordinator({
      workbookId: "workbook-a",
      cells: [cell("a0")],
    });

    await expect(result.current.attachWorkbook("workbook-b")).rejects.toBe(failure);
    mutations.attach.mockImplementationOnce(() => {
      rerender({ workbookId: "workbook-c", cells: [cell("c0")] });
      return Promise.resolve();
    });

    await expect(result.current.attachWorkbook("workbook-c")).resolves.toBeUndefined();

    expect(mutations.attach).toHaveBeenCalledTimes(2);
    expect(mutations.attach).toHaveBeenLastCalledWith({
      id: "experiment-1",
      workbookId: "workbook-c",
      expectedWorkbookId: "workbook-a",
      expectedWorkbookVersionId: "version-workbook-a",
    });
    expect(result.current.error).toBeNull();
  });

  it("rejects an attachment completion when the rerender lands on a different workbook", async () => {
    const { result, rerender } = renderCoordinator({
      workbookId: "workbook-a",
      cells: [cell("a0")],
    });
    mutations.attach.mockImplementationOnce(() => {
      rerender({ workbookId: "workbook-c", cells: [cell("c0")] });
      return Promise.resolve();
    });

    await expect(result.current.attachWorkbook("workbook-b")).rejects.toBeInstanceOf(
      PersistenceScopeChangedError,
    );
  });

  it("rejects an attachment completion when refetch leaves the rendered workbook unchanged", async () => {
    const { result } = renderCoordinator({
      workbookId: "workbook-a",
      cells: [cell("a0")],
    });

    await expect(result.current.attachWorkbook("workbook-b")).rejects.toBeInstanceOf(
      PersistenceScopeChangedError,
    );
  });

  it("rejects queued work when an external scope change makes it stale", async () => {
    let releaseUpdate: (() => void) | undefined;
    mutations.update.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          releaseUpdate = () => resolve({ id: "workbook-a" });
        }),
    );
    const { result, rerender } = renderCoordinator({
      workbookId: "workbook-a",
      cells: [cell("a0")],
    });

    rerender({ workbookId: "workbook-a", cells: [cell("a1")] });
    await act(async () => vi.advanceTimersByTimeAsync(30));
    const attachPromise = result.current.attachWorkbook("workbook-b");
    const staleAssertion = expect(attachPromise).rejects.toBeInstanceOf(
      PersistenceScopeChangedError,
    );

    rerender({ workbookId: "workbook-c", cells: [cell("c0")] });
    act(() => releaseUpdate?.());

    await staleAssertion;
    expect(mutations.attach).not.toHaveBeenCalled();
  });

  it("flushes a valid debounced edit before detaching", async () => {
    const { result, rerender } = renderCoordinator({
      workbookId: "workbook-a",
      cells: [cell("a0")],
    });

    rerender({ workbookId: "workbook-a", cells: [cell("a1")] });
    let releaseDetach: (() => void) | undefined;
    mutations.detach.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          releaseDetach = resolve;
        }),
    );
    const detachPromise = result.current.detachWorkbook();

    await act(async () => Promise.resolve());
    expect(mutations.update).toHaveBeenCalledWith({
      id: "workbook-a",
      cells: [cell("a1")],
    });
    expect(mutations.upgrade).toHaveBeenCalledTimes(1);
    expect(mutations.detach).toHaveBeenCalledTimes(1);

    rerender({ workbookId: "", cells: [] });
    await act(async () => {
      releaseDetach?.();
      await detachPromise;
    });
  });

  it("persists and flushes a valid container draft", async () => {
    const nextCells = [container("parallel-a", "plot id")];
    const { result, rerender } = renderCoordinator({
      workbookId: "workbook-a",
      cells: [cell("a0")],
    });

    rerender({ workbookId: "workbook-a", cells: nextCells });
    await act(async () => result.current.autosave.flush());

    expect(mutations.update).toHaveBeenCalledWith({
      id: "workbook-a",
      cells: nextCells,
    });
    expect(mutations.upgrade).toHaveBeenCalledTimes(1);
    expect(mutations.detach).not.toHaveBeenCalled();
  });

  it.each(invalidIdentityDrafts)(
    "blocks autosave and transition flush for %s",
    async (_caseName, invalidCells) => {
      const { result, rerender } = renderCoordinator({
        workbookId: "workbook-a",
        cells: [cell("a0")],
      });

      rerender({ workbookId: "workbook-a", cells: invalidCells });
      await act(async () => vi.advanceTimersByTimeAsync(30));

      expect(result.current.autosave.status).toBe("error");
      await expect(result.current.detachWorkbook()).rejects.toBeInstanceOf(Error);
      expect(mutations.update).not.toHaveBeenCalled();
      expect(mutations.upgrade).not.toHaveBeenCalled();
      expect(mutations.detach).not.toHaveBeenCalled();
    },
  );

  it("rejects a scope transition while the controlled draft is invalid", async () => {
    const invalidQuestion = {
      id: "question-1",
      type: "question",
      isCollapsed: false,
      name: "",
      questionType: "text",
    } as unknown as WorkbookCell;
    const { result, rerender } = renderCoordinator({
      workbookId: "workbook-a",
      cells: [cell("a0")],
    });

    rerender({ workbookId: "workbook-a", cells: [invalidQuestion] });

    await expect(result.current.detachWorkbook()).rejects.toBeInstanceOf(Error);
    expect(result.current.autosave.status).toBe("error");
    expect(mutations.update).not.toHaveBeenCalled();
    expect(mutations.detach).not.toHaveBeenCalled();
  });
});
