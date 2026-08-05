import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CommandNode } from "./command-node";

const { executeCommand, setScanResults, recordWorkbookDeviceOutcomes, nextStep } = vi.hoisted(
  () => ({
    executeCommand: vi.fn(),
    setScanResults: vi.fn(),
    recordWorkbookDeviceOutcomes: vi.fn(),
    nextStep: vi.fn(),
  }),
);

vi.mock("~/features/connection/hooks/use-device-connection", () => ({
  useConnectedDevice: () => ({
    data: { id: "usb-42", name: "MultispeQ", type: "usb" },
  }),
}));
vi.mock("~/features/connection/hooks/use-scan-manager", () => ({
  useScanner: () => ({ executeCommand }),
}));
vi.mock("~/features/connection/stores/use-scanner-command-executor-store", () => ({
  useScannerCommandExecutorStore: (selector: (state: unknown) => unknown) =>
    selector({
      executors: new Map([
        [
          "usb-42",
          {
            identity: { family: "multispeq", deviceId: "MSPx-0001", raw: {} },
          },
        ],
      ]),
    }),
}));
vi.mock("~/features/measurement-flow/stores/use-measurement-flow-store", () => ({
  useMeasurementFlowStore: () => ({
    nextStep,
    setScanResults,
    recordWorkbookDeviceOutcomes,
  }),
}));
vi.mock("~/shared/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("~/shared/observability/logger", () => ({
  createLogger: () => ({ error: vi.fn() }),
}));
vi.mock("~/shared/ui/hooks/use-theme", () => ({
  useTheme: () => ({ classes: { text: "", textMuted: "" } }),
}));
vi.mock("sonner-native", () => ({ toast: { error: vi.fn() } }));

describe("CommandNode workbook membership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retains the device and uses handshake identity for a response without device_id", async () => {
    executeCommand.mockResolvedValue("READY");
    render(<CommandNode nodeId="command-1" content={{ format: "string", content: "status" }} />);

    act(() => {
      fireEvent.press(screen.getByText("measurementFlow:commandNode.run"));
    });

    await waitFor(() => expect(setScanResults).toHaveBeenCalledOnce());
    expect(setScanResults).toHaveBeenCalledWith(
      [
        {
          device: { id: "usb-42", name: "MultispeQ" },
          measurementDeviceId: "MSPx-0001",
          producerCellId: "command-1",
          result: { response: "READY" },
        },
      ],
      "command-1",
    );
    expect(recordWorkbookDeviceOutcomes).toHaveBeenCalledWith([
      {
        producer_cell_id: "command-1",
        transport_device_id: "usb-42",
        device_id: "MSPx-0001",
        outcome: "ok",
      },
    ]);
  });
});
