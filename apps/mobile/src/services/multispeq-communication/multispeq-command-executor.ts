import { promiseWithTimeout } from "~/utils/promise-with-timeout";

import type { Emitter } from "../../utils/emitter";
import type { MultispeqStreamEvents } from "./multispeq-stream-events";

export interface IMultispeqCommandExecutor {
  execute(command: string | object): Promise<string | object>;
  destroy(): Promise<void>;
}

export class MultispeqCommandExecutor implements IMultispeqCommandExecutor {
  constructor(private readonly emitter: Emitter<MultispeqStreamEvents>) {}

  async execute(command: string | object) {
    await this.emitter.emit("sendCommandToDevice", command);

    const executePromise = new Promise<object | string>((resolve) => {
      const handler = (payload: { data: object | string; checksum: string }) => {
        resolve(payload.data);
        this.emitter.off("receivedReplyFromDevice", handler);
      };
      this.emitter.on("receivedReplyFromDevice", handler);
    });

    return promiseWithTimeout(executePromise, 20000);
  }

  destroy() {
    return this.emitter.emit("destroy");
  }
}
