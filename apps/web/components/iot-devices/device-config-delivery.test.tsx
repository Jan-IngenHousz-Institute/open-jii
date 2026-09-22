import { createIotDevice } from "@/test/factories";
import { render, screen, waitFor } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { deliverDeviceConfig } from "@repo/iot";
import { toast } from "@repo/ui/hooks/use-toast";

import { DeviceConfigDelivery } from "./device-config-delivery";

vi.mock("@repo/ui/hooks/use-toast", () => ({ toast: vi.fn() }));

const communication = {
  isConnected: false,
  isConnecting: false,
  error: null,
  deviceInfo: null,
  driver: {},
  connect: vi.fn(),
  disconnect: vi.fn(),
};

vi.mock("@/hooks/iot/useIotCommunication/useIotCommunication", () => ({
  useIotCommunication: () => communication,
}));

// jsdom supports neither transport, so support is simulated per test.
const browserSupport = {
  bluetooth: false,
  serial: false,
  any: false,
  bluetoothReason: "browser" as "browser" | "device" | null,
  serialReason: "browser" as "browser" | "device" | null,
};

vi.mock("@/hooks/iot/useIotBrowserSupport", () => ({
  useIotBrowserSupport: () => browserSupport,
}));

function setBrowserSupport(bluetooth: boolean, serial: boolean) {
  browserSupport.bluetooth = bluetooth;
  browserSupport.serial = serial;
  browserSupport.any = bluetooth || serial;
  browserSupport.bluetoothReason = bluetooth ? null : "browser";
  browserSupport.serialReason = serial ? null : "browser";
}

vi.mock("@repo/iot", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@repo/iot")>();
  return { ...actual, deliverDeviceConfig: vi.fn() };
});

const genericDevice = createIotDevice({ deviceType: "generic" });
const ambyteDevice = createIotDevice({ deviceType: "ambyte" });
const multispeqDevice = createIotDevice({ deviceType: "multispeq" });

const config = {
  thingName: genericDevice.thingName,
  deviceType: "generic" as const,
  endpoint: "abc-ats.iot.eu-central-1.amazonaws.com",
  experiments: [
    {
      experimentId: "11111111-1111-4111-8111-111111111111",
      experimentName: "E",
      topicPrefix: "experiment/data_ingest/v1/11111111-1111-4111-8111-111111111111/generic",
      workbookVersion: null,
      procedures: [],
    },
  ],
};

// Filenames of every <a download> the component would have triggered.
const downloads: string[] = [];

describe("DeviceConfigDelivery", () => {
  beforeEach(() => {
    downloads.length = 0;
    communication.isConnected = false;
    setBrowserSupport(false, false);
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      downloads.push(this.download);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("carries only the delivery actions; the manifest belongs to the rail", () => {
    render(<DeviceConfigDelivery device={genericDevice} config={config} />);

    // Endpoint and topics moved into the Configuration rail, which owns the
    // manifest in every state, not just after a mutation succeeds.
    expect(screen.queryByText(config.endpoint)).not.toBeInTheDocument();
    expect(screen.queryByText(config.experiments[0].topicPrefix)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /iot.onboarding.download/ })).toBeInTheDocument();
  });

  it("downloads the config as a JSON named after the device", async () => {
    const user = userEvent.setup();
    render(<DeviceConfigDelivery device={genericDevice} config={config} />);

    await user.click(screen.getByRole("button", { name: /iot.onboarding.download/ }));

    expect(downloads.at(-1)).toBe(`${genericDevice.thingName}-config.json`);
  });

  it("offers connect before pushing for a pushable family", () => {
    render(<DeviceConfigDelivery device={genericDevice} config={config} />);

    expect(screen.getByRole("button", { name: /iot.onboarding.connect/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /iot.onboarding.push/ })).not.toBeInTheDocument();
  });

  it("pushes the config through the device driver when connected", async () => {
    const user = userEvent.setup();
    communication.isConnected = true;
    render(<DeviceConfigDelivery device={genericDevice} config={config} />);

    await user.click(screen.getByRole("button", { name: /iot.onboarding.push/ }));

    await waitFor(() => {
      expect(deliverDeviceConfig).toHaveBeenCalledWith(communication.driver, {
        // The delivered file self-describes: the docs link rides along.
        config: { ...config, docsUrl: "http://localhost:3010/developers/device-integration" },
        id: config.thingName,
      });
    });
    expect(toast).toHaveBeenCalledWith({ title: "iot.onboarding.pushSuccess" });
  });

  it("disables Connect while the selected transport is unsupported in this browser", () => {
    render(<DeviceConfigDelivery device={genericDevice} config={config} />);

    expect(screen.getByRole("button", { name: /iot.onboarding.connect/ })).toBeDisabled();
  });

  it("enables Connect when the selected transport is supported", () => {
    setBrowserSupport(false, true);
    render(<DeviceConfigDelivery device={genericDevice} config={config} />);

    expect(screen.getByRole("button", { name: /iot.onboarding.connect/ })).toBeEnabled();
  });

  it("auto-selects the only supported transport", () => {
    // Default selection is serial; with only bluetooth available, the
    // auto-select must switch to it or Connect would stay disabled.
    setBrowserSupport(true, false);
    render(<DeviceConfigDelivery device={genericDevice} config={config} />);

    expect(screen.getByRole("button", { name: /iot.onboarding.connect/ })).toBeEnabled();
  });

  it("surfaces the driver's reason when the push fails", async () => {
    const user = userEvent.setup();
    communication.isConnected = true;
    vi.mocked(deliverDeviceConfig).mockRejectedValueOnce(new Error("SET_CONFIG unsupported"));
    render(<DeviceConfigDelivery device={genericDevice} config={config} />);

    await user.click(screen.getByRole("button", { name: /iot.onboarding.push/ }));

    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith({
        title: "iot.onboarding.pushError",
        description: "SET_CONFIG unsupported",
        variant: "destructive",
      });
    });
  });

  it("disables download and push while delivery is locked", () => {
    communication.isConnected = true;
    render(<DeviceConfigDelivery device={genericDevice} config={config} disabled />);

    expect(screen.getByRole("button", { name: /iot.onboarding.download/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /iot.onboarding.push/ })).toBeDisabled();
  });

  it("is download-only for multispeq", () => {
    render(<DeviceConfigDelivery device={multispeqDevice} config={config} />);

    expect(screen.getByText("iot.onboarding.inlineProcedureNote")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /iot.onboarding.connect/ }),
    ).not.toBeInTheDocument();
  });

  it("is download-only for ambyte, with the provisioning note", () => {
    render(<DeviceConfigDelivery device={ambyteDevice} config={config} />);

    expect(screen.getByText("iot.onboarding.provisionNote")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /iot.onboarding.connect/ }),
    ).not.toBeInTheDocument();
  });
});
