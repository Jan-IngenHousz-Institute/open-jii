export type MultispeqStreamEvents = {
  sendCommandToDevice: string | object;
  receivedReplyFromDevice: { data: object | string; checksum: string };
  destroy: void;
};
