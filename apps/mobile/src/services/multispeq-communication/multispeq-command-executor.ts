import type { Emitter } from "../../utils/emitter";
import type { MultispeqStreamEvents } from "./multispeq-stream-events";

export class MultiSpeqCommandExecutor {
  constructor(private readonly emitter: Emitter<MultispeqStreamEvents>) {}

  async execute(command: string | object) {
    await this.emitter.emit("sendCommandToDevice", command);

    return new Promise<object | string>((resolve) => {
      const handler = (payload: {
        data: object | string;
        checksum: string;
      }) => {
        resolve(payload.data);
        this.emitter.off("receivedReplyFromDevice", handler);
      };
      this.emitter.on("receivedReplyFromDevice", handler);
    });
  }

  destroy() {
    return this.emitter.emit("destroy");
  }
}
