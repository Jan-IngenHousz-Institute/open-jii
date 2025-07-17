import { protocolsDefinitions } from "~/protocols/definitions";
import { IMultispeqCommandExecutor } from "~/services/multispeq-communication/multispeq-command-executor";
import { delay } from "~/utils/delay";

export class MockCommandExecutor implements IMultispeqCommandExecutor {
  destroy(): Promise<void> {
    return Promise.resolve(undefined);
  }

  async execute(command: string | object): Promise<string | object> {
    const protocols = Object.values(protocolsDefinitions);
    const stringifiedCommand = JSON.stringify(command);

    const requestedProtocol = protocols.find(
      (p) => JSON.stringify(p.protocol) === stringifiedCommand,
    );

    await delay(300);

    if (!requestedProtocol) {
      throw new Error("Unsupported protocol");
    }

    return requestedProtocol.example;
  }
}
