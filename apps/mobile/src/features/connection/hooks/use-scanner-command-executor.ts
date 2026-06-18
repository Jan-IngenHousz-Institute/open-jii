import { useScannerCommandExecutorStore } from "~/features/connection/stores/use-scanner-command-executor-store";

export function useScannerCommandExecutor() {
  const {
    commandResponse,
    reset,
    isExecuting,
    error,
    executeCommand,
    cancelCommand,
    progress,
    scanStartedAt,
    estimatedMs,
  } = useScannerCommandExecutorStore();

  return {
    commandResponse,
    reset,
    isExecuting,
    error,
    executeCommand,
    cancelCommand,
    progress,
    scanStartedAt,
    estimatedMs,
  };
}
