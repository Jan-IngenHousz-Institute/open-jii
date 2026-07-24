import { useEffect, useRef, useState } from "react";
import { toast } from "sonner-native";
import { useConnectedDevices } from "~/features/connection/hooks/use-device-connection";
import { useMultiScanner } from "~/features/connection/hooks/use-multi-scanner";
import type { MultiScanRound, ScanAssignment } from "~/features/connection/hooks/use-multi-scanner";
import type {
  DeviceScanFailure,
  DeviceScanResult,
} from "~/features/connection/services/scan-manager/utils/partition-scan-outcomes";
import { useDeviceSheetStore } from "~/features/connection/stores/use-device-sheet-store";
import { useScannerCommandExecutorStore } from "~/features/connection/stores/use-scanner-command-executor-store";
import { classifyScanError } from "~/features/connection/utils/classify-scan-error";
import type {
  DevicePlanEntry,
  ScanResult,
} from "~/features/measurement-flow/domain/flow-transitions";
import {
  commandFailureLogFields,
  commandFailureTranslationKey,
  resolveMobileCommand,
} from "~/features/measurement-flow/domain/mobile-command-resolution";
import type { MobileCommandResolutionFailure } from "~/features/measurement-flow/domain/mobile-command-resolution";
import type { DeviceProducerOutcome } from "~/features/measurement-flow/domain/runtime-output";
import { useMeasurementFlowStore } from "~/features/measurement-flow/stores/use-measurement-flow-store";
import { playSound } from "~/features/measurement-flow/utils/play-sound";
import { useTranslation } from "~/shared/i18n";
import type { FlowNode, MeasurementContent } from "~/shared/measurements/flow-node";
import { createLogger } from "~/shared/observability/logger";
import type { Device } from "~/shared/types/device";

import { isReferencedCommand } from "@repo/api/domains/workbook/command-source.schema";
import type { CommandRef } from "@repo/api/domains/workbook/command-source.schema";

const log = createLogger("measurement-capture");

interface ResolvedTarget {
  command: string | object;
  producerCellId: string;
  producerKind: "protocol" | "command";
  protocolId?: string;
  protocolName?: string;
  commandSource?: CommandRef;
}

export interface CommandDispatchPreview {
  deviceId: string;
  deviceName: string;
  resolved?: string;
  error?: string;
}

function formatResolvedCommand(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export class MobileCommandResolutionError extends Error {
  constructor(
    readonly failure: MobileCommandResolutionFailure,
    message: string,
  ) {
    super(message);
    this.name = "MobileCommandResolutionError";
  }
}

// Resolves a dispatch target's payload from its hydrated flow node (protocol
// snapshot code or inline command), the same mechanism the current node uses.
// Errors fail only that device's round entry, never the whole round.
function resolveTargetPayload(
  node: FlowNode | undefined,
  device: Device,
  translate: (key: string) => string,
): ResolvedTarget | Error {
  const content = node?.content as MeasurementContent | undefined;
  if (!node || !content) return new Error("Dispatch target is not part of this flow");
  if (content.command) {
    const flow = useMeasurementFlowStore.getState();
    const resolved = resolveMobileCommand({
      commandCellId: node.id,
      cells: flow.cells,
      targetDeviceId: device.id,
      workbookVersionId: flow.workbookVersionId,
      executionEpoch: flow.executionEpoch,
      getRuntimeCellOutput: flow.getRuntimeCellOutput,
    });
    if (!resolved.ok) {
      log.warn(
        "command resolution failed",
        commandFailureLogFields("branch", resolved.error, {
          workbookVersionId: flow.workbookVersionId,
          executionEpoch: flow.executionEpoch,
        }),
      );
      return new MobileCommandResolutionError(
        resolved.error,
        translate(commandFailureTranslationKey(resolved.error.code)),
      );
    }
    return {
      command: resolved.value as string | object,
      producerCellId: node.id,
      producerKind: "command",
      protocolName: node.name,
      ...(isReferencedCommand(content.command) ? { commandSource: content.command.ref } : {}),
    };
  }
  const code = content.protocol?.code;
  if (!content.protocolId || !code || code.length === 0) {
    return new Error("Protocol code is unavailable for this dispatch target");
  }
  return {
    command: code,
    producerCellId: node.id,
    producerKind: "protocol",
    protocolId: content.protocolId,
    protocolName: content.protocol?.name,
  };
}

// View-model for MeasurementNode: owns the multi-scan lifecycle so the
// component is a pure render switch over the returned state. nodeId (== cell
// id) attributes the recorded result to its producing cell. See CONTEXT.md.
export function useMeasurementCapture(content: MeasurementContent, nodeId?: string) {
  const { t } = useTranslation("measurementFlow");
  // Resolved once at flow-load (hydrateFlowNodes): snapshot code + cell name.
  const protocol = content.protocol;
  const {
    executeScanAll,
    executeScanAssignments,
    isScanning,
    deviceStates,
    lastRound,
    reset: resetScan,
    cancelAll,
  } = useMultiScanner();
  const { data: devices = [], refetch: refetchConnectedDevices } = useConnectedDevices();
  const {
    nextStep,
    setScanResults,
    navigateToQuestionFromOverview,
    devicePlan,
    completeDevicePlan,
    recordDeviceProducerOutcomes,
    workbookVersionId,
    executionEpoch,
  } = useMeasurementFlowStore();
  const [commandDispatchPreviews, setCommandDispatchPreviews] = useState<CommandDispatchPreview[]>(
    [],
  );
  // The dispatch plan applies only while THIS node is one of its targets;
  // otherwise it is stale routing state and the node broadcasts as before.
  const activePlan =
    nodeId && devicePlan?.some((p) => p.targetCellId === nodeId) ? devicePlan : undefined;
  const openDeviceSheet = useDeviceSheetStore((s) => s.open);
  // Primary's live progress (legacy mirrors); the round shares one protocol so
  // the estimate applies to every device.
  const scanProgress = useScannerCommandExecutorStore((s) => s.progress);
  const scanStartedAt = useScannerCommandExecutorStore((s) => s.scanStartedAt);
  const estimatedMs = useScannerCommandExecutorStore((s) => s.estimatedMs);

  // Successes accumulated across retry rounds of one Multi-scan: a device
  // that already returned a result is not re-scanned when the user retries
  // the failed ones.
  const successesRef = useRef<DeviceScanResult[]>([]);

  // Per-device payload provenance of the dispatch round (deviceId keyed),
  // stamped onto each result so its upload carries its own protocolId.
  const assignmentMetaRef = useRef<
    Record<
      string,
      {
        protocolId?: string;
        protocolName?: string;
        producerCellId?: string;
        producerKind?: "protocol" | "command";
        dispatchedCommand?: string | object;
        commandSource?: CommandRef;
        executionEpoch?: string;
      }
    >
  >({});

  // Keep stable refs so the disconnect-cleanup effect below doesn't need to
  // list these as dependencies (avoids any memoisation concerns).
  const resetScanRef = useRef(resetScan);
  resetScanRef.current = resetScan;
  const cancelAllRef = useRef(cancelAll);
  cancelAllRef.current = cancelAll;

  // Re-entry guard: the liveness probe is awaited before executeScanAll flips
  // isScanning, so without this a double-tap could launch two scans.
  const isStartingRef = useRef(false);

  // When every device unexpectedly disconnects mid-scan, abort the in-flight
  // commands before resetting (resetting first surfaces a raw transport error
  // instead of the coherent cancelled path), then reset for a clean retry.
  useEffect(() => {
    if (devices.length === 0 && isScanning) {
      successesRef.current = [];
      void (async () => {
        try {
          await cancelAllRef.current();
        } finally {
          resetScanRef.current();
        }
      })();
    }
  }, [devices.length, isScanning]);

  useEffect(() => {
    setCommandDispatchPreviews([]);
  }, [executionEpoch, workbookVersionId]);

  const completeWithSuccesses = () => {
    // Order results by connect order so the round reads consistently everywhere.
    const orderOf = (id: string) => {
      const i = devices.findIndex((d) => d.id === id);
      return i === -1 ? Number.MAX_SAFE_INTEGER : i;
    };
    const ordered = [...successesRef.current].sort(
      (a, b) => orderOf(a.device.id) - orderOf(b.device.id),
    );
    successesRef.current = [];
    const projection = ordered.map(({ device, result }) => ({
      device: { id: device.id, name: device.name },
      result: result as ScanResult,
      ...assignmentMetaRef.current[device.id],
    }));
    if (activePlan) {
      // A device branch can fan out to several protocol/command producers.
      // Keep one combined upload/display projection, but record each reply
      // under the actual target producer for later dynamic references.
      setScanResults(projection, undefined);
      const flow = useMeasurementFlowStore.getState();
      const groups = new Map<
        string,
        { kind: "protocol" | "command"; outcomes: DeviceProducerOutcome[] }
      >();
      for (const success of ordered) {
        const plannedCellId = activePlan.find(
          (entry) => entry.deviceId === success.device.id,
        )?.targetCellId;
        const producerCellId = success.producerCellId ?? plannedCellId;
        const producerNode = flow.flowNodes.find((entry) => entry.id === producerCellId);
        const kind =
          success.producerKind ?? (producerNode?.content?.command ? "command" : "protocol");
        if (!producerCellId) continue;
        const group = groups.get(producerCellId) ?? { kind, outcomes: [] };
        group.outcomes.push({
          device: { id: success.device.id, name: success.device.name },
          data: success.result,
        });
        groups.set(producerCellId, group);
      }
      for (const [producerCellId, group] of groups) {
        recordDeviceProducerOutcomes(producerCellId, group.kind, group.outcomes);
      }
    } else {
      setScanResults(projection, nodeId);
    }
    assignmentMetaRef.current = {};
    // The round covered every dispatch target; consumedNodeIds keeps skipping
    // the other targets once while the plan itself is done.
    if (activePlan) completeDevicePlan();
    // Single-node flows wrap nextStep() straight back to this same mounted
    // node; clear the finished round first so it renders Ready again instead
    // of a stale scanning screen with a dead Cancel button.
    resetScan();
    // Play system notification sound when measurement completes. Never block
    // flow advance on audio.
    playSound().catch((e) => log.warn("playSound failed", { err: (e as Error)?.message }));
    nextStep();
  };

  // Build per-device assignments from the plan; a device whose target payload
  // cannot be resolved fails its own entry, the rest of the round still runs.
  const runDispatchRound = (plan: DevicePlanEntry[], pendingDevices: Device[]) => {
    const { flowNodes } = useMeasurementFlowStore.getState();
    const assignments: ScanAssignment[] = [];
    const prefailed: DeviceScanFailure[] = [];
    const previews: CommandDispatchPreview[] = [];
    for (const device of pendingDevices) {
      const target = plan.find((p) => p.deviceId === device.id);
      const node = flowNodes.find((n) => n.id === target?.targetCellId);
      const resolved = resolveTargetPayload(node, device, t);
      if (resolved instanceof Error) {
        prefailed.push({ device, error: resolved });
        if (node?.content?.command) {
          previews.push({
            deviceId: device.id,
            deviceName: device.name,
            error: resolved.message,
          });
        }
      } else {
        assignments.push({ device, ...resolved });
        if (resolved.producerKind === "command") {
          previews.push({
            deviceId: device.id,
            deviceName: device.name,
            resolved: formatResolvedCommand(resolved.command),
          });
        }
        assignmentMetaRef.current[device.id] = {
          protocolId: resolved.protocolId,
          protocolName: resolved.protocolName,
          producerCellId: resolved.producerCellId,
          producerKind: resolved.producerKind,
          ...(resolved.producerKind === "command" ? { dispatchedCommand: resolved.command } : {}),
          ...(resolved.commandSource ? { commandSource: resolved.commandSource } : {}),
          ...(executionEpoch ? { executionEpoch } : {}),
        };
      }
    }
    setCommandDispatchPreviews(previews);
    return executeScanAssignments(assignments, prefailed);
  };

  const startScan = async () => {
    if (isScanning || isStartingRef.current) return;
    isStartingRef.current = true;
    try {
      if (devices.length === 0) {
        toast.error(t("measurementFlow:measurementNode.toast.notConnected"));
        return;
      }
      // A dispatch round resolves each device's payload from ITS target cell,
      // so the current node's own protocol guards only apply to broadcast.
      if (!activePlan) {
        if (!content.protocolId) {
          toast.error(t("measurementFlow:measurementNode.toast.noProtocol"));
          return;
        }
        if (!protocol) {
          toast.error(t("measurementFlow:measurementNode.toast.protocolUnavailable"));
          return;
        }
      }

      // The cached device list is polled (~3s) and lags a real drop; probe the
      // live connections first so we fail with a reconnect prompt, not a long hang.
      const { data: liveDevices } = await refetchConnectedDevices();
      if (!liveDevices || liveDevices.length === 0) {
        log.warn("scan blocked: no device connected");
        toast.error(t("measurementFlow:measurementNode.toast.deviceDisconnected"));
        return;
      }

      // Only scan devices that haven't succeeded in a previous round; a
      // dispatch round additionally covers only the devices in the plan.
      const pendingDevices = liveDevices.filter(
        (d) =>
          !successesRef.current.some((s) => s.device.id === d.id) &&
          (!activePlan || activePlan.some((p) => p.deviceId === d.id)),
      );
      if (pendingDevices.length === 0) {
        completeWithSuccesses();
        return;
      }

      try {
        let round: MultiScanRound;
        if (activePlan) {
          round = await runDispatchRound(activePlan, pendingDevices);
        } else if (protocol) {
          if (nodeId) {
            for (const device of pendingDevices) {
              assignmentMetaRef.current[device.id] = {
                producerCellId: nodeId,
                producerKind: "protocol",
                ...(executionEpoch ? { executionEpoch } : {}),
              };
            }
          }
          round = await executeScanAll(protocol, pendingDevices);
        } else {
          return; // unreachable: guarded above
        }
        successesRef.current = [
          ...successesRef.current.filter(
            (s) => !round.successes.some((r) => r.device.id === s.device.id),
          ),
          ...round.successes,
        ];

        // Only a command assignment that actually reached transport owns a
        // failed command output. Resolver pre-failures carry no dispatch
        // metadata and remain non-executions.
        const commandFailureGroups = new Map<string, DeviceProducerOutcome[]>();
        for (const failure of round.failures) {
          if (
            !failure.wasDispatched ||
            failure.producerKind !== "command" ||
            !failure.producerCellId
          ) {
            continue;
          }
          const outcomes = commandFailureGroups.get(failure.producerCellId) ?? [];
          outcomes.push({
            device: { id: failure.device.id, name: failure.device.name },
            error: "COMMAND_EXECUTION_FAILED",
          });
          commandFailureGroups.set(failure.producerCellId, outcomes);
        }
        for (const [producerCellId, outcomes] of commandFailureGroups) {
          recordDeviceProducerOutcomes(producerCellId, "command", outcomes);
        }

        if (round.failures.length > 0 && successesRef.current.length === 0) {
          const kind = classifyScanError(round.failures[0].error);
          // Cancellation is user-initiated and handled by the cancel path.
          if (kind === "cancelled") {
            return;
          }
          if (kind === "disconnected") {
            log.error("scan error: device disconnected", {
              err: round.failures[0].error.message,
            });
            toast.error(t("measurementFlow:measurementNode.toast.deviceDisconnected"));
            return;
          }
          log.error("scan error", { err: round.failures[0].error.message });
          toast.error(t("measurementFlow:measurementNode.toast.scanError"));
          return;
        }
        if (round.failures.length === 0) {
          completeWithSuccesses();
        }
        // Mixed round: the partial-failure state in MeasurementNode offers
        // continue-with-successful / retry-failed.
      } catch (error) {
        log.error("scan error", { err: (error as Error)?.message });
        toast.error(t("measurementFlow:measurementNode.toast.scanError"));
      }
    } finally {
      isStartingRef.current = false;
    }
  };

  const cancelScan = () => {
    successesRef.current = [];
    assignmentMetaRef.current = {};
    // Await the cancel before resetting so the commands settle as
    // "Measurement cancelled", not a raw error the scan catch would misread.
    void (async () => {
      try {
        await cancelAllRef.current();
      } finally {
        resetScanRef.current();
      }
    })();
  };

  return {
    device: devices[0] ?? null,
    devices,
    protocol,
    isScanning,
    deviceStates,
    lastRound,
    succeededCount: successesRef.current.length,
    startScan,
    cancelScan,
    completeWithSuccesses,
    openDeviceSheet,
    navigateToQuestionFromOverview,
    scanProgress,
    scanStartedAt,
    estimatedMs,
    commandDispatchPreviews,
  };
}
