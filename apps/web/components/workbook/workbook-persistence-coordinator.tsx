"use client";

import { useAttachWorkbook } from "@/hooks/experiment/useAttachWorkbook/useAttachWorkbook";
import { useDetachWorkbook } from "@/hooks/experiment/useDetachWorkbook/useDetachWorkbook";
import { useSetWorkbookVersion } from "@/hooks/experiment/useSetWorkbookVersion/useSetWorkbookVersion";
import { useUpgradeWorkbookVersion } from "@/hooks/experiment/useUpgradeWorkbookVersion/useUpgradeWorkbookVersion";
import { useAutosave } from "@/hooks/useAutosave";
import type { UseAutosaveReturn } from "@/hooks/useAutosave";
import { useWorkbookUpdate } from "@/hooks/workbook/useWorkbookUpdate/useWorkbookUpdate";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import type { WorkbookCell } from "@repo/api/domains/workbook/workbook-cells.schema";
import { zWorkbookCellArray } from "@repo/api/domains/workbook/workbook-cells.schema";

type OperationKind =
  | "cells"
  | "entity"
  | "manual-upgrade"
  | "rename"
  | "attach"
  | "detach"
  | "set-version";

interface PersistenceOperation {
  kind: OperationKind;
  scope: string;
  generation: number;
  fingerprint?: string;
  run: (isCurrent: () => boolean) => Promise<void>;
}

interface FailedPersistenceOperation {
  operation: PersistenceOperation;
  error: unknown;
}

export interface WorkbookPersistenceCoordinator {
  autosave: UseAutosaveReturn;
  entitySaved: () => Promise<void>;
  manualUpgrade: () => Promise<void>;
  renameWorkbook: (name: string) => Promise<void>;
  attachWorkbook: (nextWorkbookId: string) => Promise<void>;
  detachWorkbook: () => Promise<void>;
  setWorkbookVersion: (versionId: string) => Promise<void>;
  retryFailed: () => Promise<void>;
  isPending: boolean;
  error: unknown;
}

interface CoordinatorOptions {
  experimentId: string;
  workbookId: string;
  cells: WorkbookCell[];
  enabled: boolean;
  delayMs?: number;
}

const WorkbookPersistenceContext = createContext<WorkbookPersistenceCoordinator | null>(null);

/**
 * Persistence invariant for the experiment workbook editor:
 *
 * Every cells write, entity-triggered pin, manual pin, and workbook scope
 * transition enters this one workbook-keyed queue. Operations check the scope
 * generation after each awaited write; a completion from an older workbook is
 * inert and cannot start another write or rebase the new workbook's autosave.
 */
export function useWorkbookPersistenceCoordinator({
  experimentId,
  workbookId,
  cells,
  enabled,
  delayMs = 1500,
}: CoordinatorOptions): WorkbookPersistenceCoordinator {
  const { mutateAsync: updateWorkbook } = useWorkbookUpdate(workbookId);
  const { mutateAsync: upgradeWorkbook } = useUpgradeWorkbookVersion(experimentId);
  const { mutateAsync: attachWorkbookMutation } = useAttachWorkbook();
  const { mutateAsync: detachWorkbookMutation } = useDetachWorkbook();
  const { mutateAsync: setWorkbookVersionMutation } = useSetWorkbookVersion(experimentId);

  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const scopeRef = useRef({ workbookId, generation: 0 });
  const tailRef = useRef<Promise<void>>(Promise.resolve());
  const pendingCountRef = useRef(0);
  const failedOperationRef = useRef<FailedPersistenceOperation | null>(null);

  if (scopeRef.current.workbookId !== workbookId) {
    scopeRef.current = {
      workbookId,
      generation: scopeRef.current.generation + 1,
    };
    // The new workbook owns a new queue. The old queue may finish, but all of
    // its operations carry the previous generation and are discarded.
    tailRef.current = Promise.resolve();
    pendingCountRef.current = 0;
    failedOperationRef.current = null;
  }

  useEffect(() => {
    setIsPending(false);
    setError(null);
  }, [workbookId]);

  const isOperationCurrent = useCallback(
    (operation: PersistenceOperation) =>
      scopeRef.current.workbookId === operation.scope &&
      scopeRef.current.generation === operation.generation,
    [],
  );

  const enqueue = useCallback(
    (candidate: PersistenceOperation): Promise<void> => {
      if (!isOperationCurrent(candidate)) return Promise.resolve();
      // Capture the barrier as it exists when this request is made. Work that
      // was already queued before a failure may not silently retry past it;
      // an explicit retry/new edit first replays the retained failed unit.
      const failedAtEnqueue = failedOperationRef.current;
      pendingCountRef.current += 1;
      setIsPending(true);
      setError(null);

      const previous = tailRef.current.catch(() => undefined);
      const promise = previous.then(async () => {
        if (!isOperationCurrent(candidate)) return;

        const runOperation = async (operation: PersistenceOperation) => {
          if (!isOperationCurrent(operation)) return;
          try {
            await operation.run(() => isOperationCurrent(operation));
            if (!isOperationCurrent(operation)) return;
            if (failedOperationRef.current?.operation === operation) {
              failedOperationRef.current = null;
            }
          } catch (operationError) {
            if (!isOperationCurrent(operation)) return;
            failedOperationRef.current = { operation, error: operationError };
            setError(operationError);
            throw operationError;
          }
        };

        try {
          const currentFailure = failedOperationRef.current;
          if (failedAtEnqueue && currentFailure === failedAtEnqueue) {
            await runOperation(failedAtEnqueue.operation);
            const failedOperation = failedAtEnqueue.operation;
            const candidateIsRetry =
              failedOperation.kind === candidate.kind &&
              failedOperation.scope === candidate.scope &&
              failedOperation.generation === candidate.generation &&
              failedOperation.fingerprint === candidate.fingerprint;
            if (candidateIsRetry) return;
          } else if (currentFailure) {
            // This operation was queued before another unit failed. Preserve
            // ordering and the original retryable failure instead of crossing it.
            setError(currentFailure.error);
            throw currentFailure.error;
          }

          await runOperation(candidate);
        } finally {
          if (isOperationCurrent(candidate)) {
            pendingCountRef.current = Math.max(0, pendingCountRef.current - 1);
            setIsPending(pendingCountRef.current > 0);
          }
        }
      });
      tailRef.current = promise.catch(() => undefined);
      return promise;
    },
    [isOperationCurrent],
  );

  const makeOperation = useCallback(
    (
      kind: OperationKind,
      run: PersistenceOperation["run"],
      fingerprint?: string,
    ): PersistenceOperation => ({
      kind,
      scope: workbookId,
      generation: scopeRef.current.generation,
      fingerprint,
      run,
    }),
    [workbookId],
  );

  const persistCells = useCallback(
    async (nextCells: WorkbookCell[]) => {
      let workbookWritten = false;
      const fingerprint = JSON.stringify(nextCells);
      await enqueue(
        makeOperation(
          "cells",
          async (isCurrent) => {
            if (!workbookWritten) {
              await updateWorkbook({ id: workbookId, cells: nextCells });
              if (!isCurrent()) return;
              workbookWritten = true;
            }
            await upgradeWorkbook({ id: experimentId });
          },
          fingerprint,
        ),
      );
    },
    [enqueue, experimentId, makeOperation, updateWorkbook, upgradeWorkbook, workbookId],
  );

  const enqueuePin = useCallback(
    (kind: "entity" | "manual-upgrade") =>
      enqueue(
        makeOperation(kind, async (isCurrent) => {
          if (!isCurrent()) return;
          await upgradeWorkbook({ id: experimentId });
        }),
      ),
    [enqueue, experimentId, makeOperation, upgradeWorkbook],
  );

  const entitySaved = useCallback(() => enqueuePin("entity"), [enqueuePin]);
  const manualUpgrade = useCallback(() => enqueuePin("manual-upgrade"), [enqueuePin]);

  const renameWorkbook = useCallback(
    (name: string) =>
      enqueue(
        makeOperation(
          "rename",
          async (isCurrent) => {
            if (!isCurrent()) return;
            await updateWorkbook({ id: workbookId, name });
          },
          name,
        ),
      ),
    [enqueue, makeOperation, updateWorkbook, workbookId],
  );

  const attachWorkbook = useCallback(
    (nextWorkbookId: string) =>
      enqueue(
        makeOperation(
          "attach",
          async (isCurrent) => {
            if (!isCurrent()) return;
            await attachWorkbookMutation({ id: experimentId, workbookId: nextWorkbookId });
          },
          nextWorkbookId,
        ),
      ),
    [attachWorkbookMutation, enqueue, experimentId, makeOperation],
  );

  const detachWorkbook = useCallback(
    () =>
      enqueue(
        makeOperation("detach", async (isCurrent) => {
          if (!isCurrent()) return;
          await detachWorkbookMutation({ id: experimentId });
        }),
      ),
    [detachWorkbookMutation, enqueue, experimentId, makeOperation],
  );

  const setWorkbookVersion = useCallback(
    (versionId: string) =>
      enqueue(
        makeOperation(
          "set-version",
          async (isCurrent) => {
            if (!isCurrent()) return;
            await setWorkbookVersionMutation({ id: experimentId, versionId });
          },
          versionId,
        ),
      ),
    [enqueue, experimentId, makeOperation, setWorkbookVersionMutation],
  );

  const retryFailed = useCallback(async () => {
    const failed = failedOperationRef.current;
    if (failed && isOperationCurrent(failed.operation)) await enqueue(failed.operation);
  }, [enqueue, isOperationCurrent]);

  const autosave = useAutosave({
    value: cells,
    toKey: useCallback((value: WorkbookCell[]) => JSON.stringify(value), []),
    save: persistCells,
    isValid: useCallback(
      (value: WorkbookCell[]) => zWorkbookCellArray.safeParse(value).success,
      [],
    ),
    delayMs,
    enabled,
    scopeKey: workbookId,
  });

  return {
    autosave,
    entitySaved,
    manualUpgrade,
    renameWorkbook,
    attachWorkbook,
    detachWorkbook,
    setWorkbookVersion,
    retryFailed,
    isPending,
    error,
  };
}

export function WorkbookPersistenceCoordinatorProvider({
  coordinator,
  children,
}: {
  coordinator: WorkbookPersistenceCoordinator;
  children: ReactNode;
}) {
  return (
    <WorkbookPersistenceContext.Provider value={coordinator}>
      {children}
    </WorkbookPersistenceContext.Provider>
  );
}

export function useWorkbookPersistence(): WorkbookPersistenceCoordinator {
  const coordinator = useContext(WorkbookPersistenceContext);
  if (!coordinator) {
    throw new Error("Workbook persistence must be owned by WorkbookPersistenceCoordinatorProvider");
  }
  return coordinator;
}
