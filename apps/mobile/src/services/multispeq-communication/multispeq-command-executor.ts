import { Emitter } from "../../utils/emitter";
import { MultispeqStreamEvents } from "./multispeq-stream-events";

export class MultiSpeqCommandExecutor {
  constructor(private readonly emitter: Emitter<MultispeqStreamEvents>) {}

  async execute(command: string | object) {
    console.log("executing command", command);
    this.emitter.emit("sendCommandToDevice", command);

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
}
