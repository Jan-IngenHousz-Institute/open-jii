import { useAsync, useAsyncCallback } from "react-async-hook";
import { useConnectedDevice } from "~/services/device-connection-manager/device-connection-manager";
import { createMultispeqCommandExecutor } from "~/services/scan-manager/utils/create-multispeq-command-executor";

export function useScannerCommandExecutor() {
  const { data: device } = useConnectedDevice();
  const { result: commandExecutor } = useAsync(
    () => createMultispeqCommandExecutor(device ?? undefined),
    [device?.id],
  );

  const {
    result: commandResponse,
    reset,
    loading: isExecuting,
    error,
    execute: executeCommand,
  } = useAsyncCallback((command: string | object) => commandExecutor?.execute(command));

  return {
    commandResponse,
    reset,
    isExecuting,
    error,
    executeCommand,
  };
}
