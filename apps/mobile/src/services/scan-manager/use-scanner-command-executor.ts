import { useScannerCommandExecutorStore } from "~/stores/use-scanner-command-executor-store";

export function useScannerCommandExecutor() {
  const { commandResponse, reset, isExecuting, error, executeCommand } =
    useScannerCommandExecutorStore();

  return {
    commandResponse,
    reset,
    isExecuting,
    error,
    executeCommand,
  };
}
