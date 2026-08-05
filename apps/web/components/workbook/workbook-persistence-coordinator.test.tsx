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
        workbookVersionId: workbookId ? `version-${workbookId}` : "",
        workbookRevision: workbookId ? 1 : 0,
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
    mutations.update.mockImplementation(({ id }: { id: string }) =>
      Promise.resolve({ id, revision: 2 }),
    );
    mutations.upgrade.mockResolvedValue({ workbookVersionId: "version-next" });
    mutations.attach.mockResolvedValue({ workbookVersionId: "version-attached" });
    mutations.detach.mockResolvedValue(undefined);
    mutations.setVersion.mockResolvedValue({ workbookVersionId: "version-restored" });
  });

  afterEach(() => vi.useRealTimers());

  it("serializes a cells write and its pin before an entity pin and attachment", async () => {
    let releaseUpdate: (() => void) | undefined;
    mutations.update.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          releaseUpdate = () => resolve({ id: "workbook-a", revision: 2 });
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
    const attachPromise = result.current.attachWorkbook({ id: "workbook-b", revision: 1 });

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
      expectedWorkbookRevision: 1,
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
          releaseOldUpdate = () => resolve({ id: "workbook-a", revision: 2 });
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

    await expect(result.current.attachWorkbook({ id: "workbook-b", revision: 1 })).rejects.toBe(
      failure,
    );

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
      expectedWorkbookRevision: 2,
    });
  });

  it("lets a different attachment supersede a failed one and follows the successful rerender", async () => {
    const failure = new Error("attach B failed");
    mutations.attach.mockRejectedValueOnce(failure);
    const { result, rerender } = renderCoordinator({
      workbookId: "workbook-a",
      cells: [cell("a0")],
    });

    await expect(result.current.attachWorkbook({ id: "workbook-b", revision: 1 })).rejects.toBe(
      failure,
    );
    mutations.attach.mockImplementationOnce(() => {
      rerender({ workbookId: "workbook-c", cells: [cell("c0")] });
      return Promise.resolve();
    });

    await expect(
      result.current.attachWorkbook({ id: "workbook-c", revision: 1 }),
    ).resolves.toBeUndefined();

    expect(mutations.attach).toHaveBeenCalledTimes(2);
    expect(mutations.attach).toHaveBeenLastCalledWith({
      id: "experiment-1",
      workbookId: "workbook-c",
      expectedWorkbookId: "workbook-a",
      expectedWorkbookVersionId: "version-workbook-a",
      expectedWorkbookRevision: 1,
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

    await expect(
      result.current.attachWorkbook({ id: "workbook-b", revision: 1 }),
    ).rejects.toBeInstanceOf(PersistenceScopeChangedError);
  });

  it("rejects an attachment completion when refetch leaves the rendered workbook unchanged", async () => {
    const { result } = renderCoordinator({
      workbookId: "workbook-a",
      cells: [cell("a0")],
    });

    await expect(
      result.current.attachWorkbook({ id: "workbook-b", revision: 1 }),
    ).rejects.toBeInstanceOf(PersistenceScopeChangedError);
  });

  it("rejects queued work when an external scope change makes it stale", async () => {
    let releaseUpdate: (() => void) | undefined;
    mutations.update.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          releaseUpdate = () => resolve({ id: "workbook-a", revision: 2 });
        }),
    );
    const { result, rerender } = renderCoordinator({
      workbookId: "workbook-a",
      cells: [cell("a0")],
    });

    rerender({ workbookId: "workbook-a", cells: [cell("a1")] });
    await act(async () => vi.advanceTimersByTimeAsync(30));
    const attachPromise = result.current.attachWorkbook({ id: "workbook-b", revision: 1 });
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
