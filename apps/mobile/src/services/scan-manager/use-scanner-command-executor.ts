import { useScannerCommandExecutorStore } from "~/stores/use-scanner-command-executor-store";

export function useScannerCommandExecutor() {
  const { commandResponse, reset, isExecuting, error, executeCommand, cancelCommand } =
    useScannerCommandExecutorStore();

  return {
    commandResponse,
    reset,
    isExecuting,
    error,
    executeCommand,
    cancelCommand,
  };
}
