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

const cell = (id: string, content = id): WorkbookCell => ({
  id,
  type: "markdown",
  isCollapsed: false,
  content,
});

interface HarnessProps {
  workbookId: string;
  cells: WorkbookCell[];
}

const renderCoordinator = (initialProps: HarnessProps) =>
  renderHook(
    ({ workbookId, cells }: HarnessProps) =>
      useWorkbookPersistenceCoordinator({
        experimentId: "experiment-1",
        workbookId,
        cells,
        enabled: true,
        delayMs: 20,
      }),
    { initialProps },
  );

describe("useWorkbookPersistenceCoordinator", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mutations.update.mockResolvedValue(undefined);
    mutations.upgrade.mockResolvedValue(undefined);
    mutations.attach.mockResolvedValue(undefined);
    mutations.detach.mockResolvedValue(undefined);
    mutations.setVersion.mockResolvedValue(undefined);
  });

  afterEach(() => vi.useRealTimers());

  it("serializes a cells write and its pin before an entity pin and attachment", async () => {
    let releaseUpdate: (() => void) | undefined;
    mutations.update.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          releaseUpdate = resolve;
        }),
    );
    const { result, rerender } = renderCoordinator({
      workbookId: "workbook-a",
      cells: [cell("a0")],
    });

    rerender({ workbookId: "workbook-a", cells: [cell("a1")] });
    await act(async () => vi.advanceTimersByTimeAsync(30));
    const entityPromise = result.current.entitySaved();
    const attachPromise = result.current.attachWorkbook("workbook-b");
    mutations.attach.mockImplementationOnce(() => {
      rerender({ workbookId: "workbook-b", cells: [cell("b0")] });
      return Promise.resolve();
    });

    expect(mutations.update).toHaveBeenCalledTimes(1);
    expect(mutations.upgrade).not.toHaveBeenCalled();
    expect(mutations.attach).not.toHaveBeenCalled();

    await act(async () => {
      releaseUpdate?.();
      await Promise.all([entityPromise, attachPromise]);
    });

    expect(mutations.upgrade).toHaveBeenCalledTimes(2);
    expect(mutations.attach).toHaveBeenCalledTimes(1);
    expect(mutations.attach).toHaveBeenCalledWith({
      id: "experiment-1",
      workbookId: "workbook-b",
      expectedWorkbookId: "workbook-a",
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
    mutations.upgrade.mockRejectedValueOnce(failure).mockResolvedValueOnce(undefined);
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
        new Promise<void>((resolve) => {
          releaseOldUpdate = resolve;
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

    mutations.upgrade.mockResolvedValue(undefined);
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

  it("rejects queued work when an external scope change makes it stale", async () => {
    let releaseUpdate: (() => void) | undefined;
    mutations.update.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          releaseUpdate = resolve;
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
});
