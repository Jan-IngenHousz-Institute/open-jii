import {
  IMultispeqCommandExecutor,
  MultispeqCommandExecutor
} from "~/services/multispeq-communication/multispeq-command-executor";

export class DisposableMultispeqCommandExecutor implements IMultispeqCommandExecutor {
  constructor(private readonly createCommandExecutor: () => Promise<MultispeqCommandExecutor>) {}

  async execute(command: string | object): Promise<string | object> {
    const commandExecutor = await this.createCommandExecutor()
    const response = await commandExecutor.execute(command)
    await commandExecutor.destroy()
    return response;
  }

  destroy(): Promise<void> {
    return Promise.resolve(undefined);
  }
}