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
  scopeTransition?: boolean;
  resultScope?: string;
  run: (assertCurrent: () => void) => Promise<void>;
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

export class PersistenceScopeChangedError extends Error {
  constructor() {
    super("The workbook changed before this operation could complete");
    this.name = "PersistenceScopeChangedError";
  }
}

/**
 * Persistence invariant for the experiment workbook editor:
 *
 * Every cells write, entity-triggered pin, manual pin, and workbook scope
 * transition enters this one workbook-keyed queue. Operations check the scope
 * generation after each awaited write; work from an older workbook rejects as
 * stale and cannot start another write or rebase the new workbook's autosave.
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
  const writtenCellsRef = useRef(new Set<string>());

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
    writtenCellsRef.current.clear();
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

  const assertOperationCurrent = useCallback(
    (operation: PersistenceOperation) => {
      if (!isOperationCurrent(operation)) throw new PersistenceScopeChangedError();
    },
    [isOperationCurrent],
  );

  const isSameOperation = useCallback(
    (left: PersistenceOperation, right: PersistenceOperation) =>
      left.kind === right.kind &&
      left.scope === right.scope &&
      left.generation === right.generation &&
      left.fingerprint === right.fingerprint,
    [],
  );

  const enqueue = useCallback(
    (candidate: PersistenceOperation): Promise<void> => {
      if (!isOperationCurrent(candidate)) {
        return Promise.reject(new PersistenceScopeChangedError());
      }
      pendingCountRef.current += 1;
      setIsPending(true);
      setError(null);

      const previous = tailRef.current.catch(() => undefined);
      const promise = previous.then(async () => {
        assertOperationCurrent(candidate);

        const runOperation = async (operation: PersistenceOperation) => {
          assertOperationCurrent(operation);
          try {
            await operation.run(() => assertOperationCurrent(operation));
            if (!operation.scopeTransition) {
              assertOperationCurrent(operation);
            } else if (
              !isOperationCurrent(operation) &&
              scopeRef.current.workbookId !== operation.resultScope
            ) {
              throw new PersistenceScopeChangedError();
            }
            if (failedOperationRef.current?.operation === operation) {
              failedOperationRef.current = null;
            }
          } catch (operationError) {
            if (isOperationCurrent(operation)) {
              failedOperationRef.current = { operation, error: operationError };
              setError(operationError);
            }
            throw operationError;
          }
        };

        try {
          const currentFailure = failedOperationRef.current;
          if (currentFailure && isSameOperation(currentFailure.operation, candidate)) {
            // Repeating the exact failed request is the explicit retry path.
            await runOperation(currentFailure.operation);
            return;
          }
          if (currentFailure) {
            // Different work supersedes the failed request. Never replay a
            // stale attach/detach in front of the operation the user just chose.
            failedOperationRef.current = null;
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
    [assertOperationCurrent, isOperationCurrent, isSameOperation],
  );

  const makeOperation = useCallback(
    (
      kind: OperationKind,
      run: PersistenceOperation["run"],
      fingerprint?: string,
      scopeTransition = false,
      resultScope?: string,
    ): PersistenceOperation => ({
      kind,
      scope: workbookId,
      generation: scopeRef.current.generation,
      fingerprint,
      scopeTransition,
      resultScope,
      run,
    }),
    [workbookId],
  );

  const persistCells = useCallback(
    async (nextCells: WorkbookCell[]) => {
      const fingerprint = JSON.stringify(nextCells);
      await enqueue(
        makeOperation(
          "cells",
          async (assertCurrent) => {
            if (!writtenCellsRef.current.has(fingerprint)) {
              assertCurrent();
              await updateWorkbook({ id: workbookId, cells: nextCells });
              assertCurrent();
              writtenCellsRef.current.clear();
              writtenCellsRef.current.add(fingerprint);
            }
            await upgradeWorkbook({ id: experimentId, expectedWorkbookId: workbookId });
            assertCurrent();
            writtenCellsRef.current.delete(fingerprint);
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
        makeOperation(kind, async (assertCurrent) => {
          assertCurrent();
          await upgradeWorkbook({ id: experimentId, expectedWorkbookId: workbookId });
          assertCurrent();
        }),
      ),
    [enqueue, experimentId, makeOperation, upgradeWorkbook, workbookId],
  );

  const entitySaved = useCallback(() => enqueuePin("entity"), [enqueuePin]);
  const manualUpgrade = useCallback(() => enqueuePin("manual-upgrade"), [enqueuePin]);

  const renameWorkbook = useCallback(
    (name: string) =>
      enqueue(
        makeOperation(
          "rename",
          async (assertCurrent) => {
            assertCurrent();
            await updateWorkbook({ id: workbookId, name });
            assertCurrent();
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
          async (assertCurrent) => {
            assertCurrent();
            await attachWorkbookMutation({
              id: experimentId,
              workbookId: nextWorkbookId,
              expectedWorkbookId: workbookId || null,
            });
          },
          nextWorkbookId,
          true,
          nextWorkbookId,
        ),
      ),
    [attachWorkbookMutation, enqueue, experimentId, makeOperation, workbookId],
  );

  const detachWorkbook = useCallback(
    () =>
      enqueue(
        makeOperation(
          "detach",
          async (assertCurrent) => {
            assertCurrent();
            await detachWorkbookMutation({ id: experimentId });
          },
          undefined,
          true,
          "",
        ),
      ),
    [detachWorkbookMutation, enqueue, experimentId, makeOperation],
  );

  const setWorkbookVersion = useCallback(
    (versionId: string) =>
      enqueue(
        makeOperation(
          "set-version",
          async (assertCurrent) => {
            assertCurrent();
            await setWorkbookVersionMutation({ id: experimentId, versionId });
            assertCurrent();
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
