import { render, screen } from "@testing-library/react-native";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import type { Device } from "~/shared/types/device";

import { ConnectedDeviceRow } from "./connected-device-row";

vi.mock("~/shared/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) => {
      const labels: Record<string, string> = {
        "identity.unknownDevice": "Unknown device",
        "identity.measurementDevice": "Measurement device",
        "deviceSheet.connectedViaBluetooth": "Connected via Bluetooth",
        "deviceSheet.connectedViaCable": "Connected via cable",
        "deviceSheet.disconnect": "Disconnect",
      };
      if (key === "identity.identifier") return `ID ${String(values?.id)}`;
      if (key === "deviceSheet.battery") return `Battery ${String(values?.battery)}%`;
      return labels[key] ?? key;
    },
  }),
}));

const device: Device = {
  type: "bluetooth-classic",
  id: "AA:BB:CC:DD:EE:FF",
  name: "AA:BB:CC:DD:EE:FF",
};

describe("ConnectedDeviceRow identity hierarchy", () => {
  it("renders a reported name first with product context", () => {
    render(
      <ConnectedDeviceRow
        device={device}
        identity={{ family: "multispeq", name: "Plot probe", raw: {} }}
        batteryLevel={87}
        onDisconnect={vi.fn()}
      />,
    );

    expect(screen.getByText("Plot probe")).toBeTruthy();
    expect(screen.getByText(/MultispeQ · Measurement device/)).toBeTruthy();
    expect(screen.getByText(/Battery 87%/)).toBeTruthy();
  });

  it("renders the canonical product when only family identity is known", () => {
    render(
      <ConnectedDeviceRow
        device={device}
        identity={{ family: "multispeq", raw: {} }}
        onDisconnect={vi.fn()}
      />,
    );

    expect(screen.getByText("MultispeQ")).toBeTruthy();
    expect(screen.getByText(/ID AA:BB:CC:DD:EE:FF/)).toBeTruthy();
  });

  it("renders Unknown device without a MultispeQ fallback before identity", () => {
    render(<ConnectedDeviceRow device={device} onDisconnect={vi.fn()} />);

    expect(screen.getByText("Unknown device")).toBeTruthy();
    expect(screen.queryByText("MultispeQ")).toBeNull();
    expect(screen.getByText(/ID AA:BB:CC:DD:EE:FF/)).toBeTruthy();
  });
});
