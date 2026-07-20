import { vi } from "vitest";

import type { ITransportAdapter } from "../../transport/interface";

export type MockTransport = ITransportAdapter & { simulateData: (data: string) => void };

/** Transport stub with the concrete adapters' single-callback replace semantics. */
export function createMockTransport(): MockTransport {
  let dataCallback: ((data: string) => void) | undefined;

  return {
    isConnected: vi.fn().mockReturnValue(true),
    send: vi.fn().mockResolvedValue(undefined),
    onDataReceived: vi.fn((cb: (data: string) => void) => {
      dataCallback = cb;
    }),
    onStatusChanged: vi.fn(),
    disconnect: vi.fn().mockResolvedValue(undefined),
    simulateData(data: string) {
      dataCallback?.(data);
    },
  };
}
