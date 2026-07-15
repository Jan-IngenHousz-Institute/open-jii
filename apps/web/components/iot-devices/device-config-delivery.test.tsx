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

vi.mock("@repo/iot", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@repo/iot")>();
  return { ...actual, deliverDeviceConfig: vi.fn() };
});

const ambyteDevice = createIotDevice({ deviceType: "ambyte" });
const multispeqDevice = createIotDevice({ deviceType: "multispeq" });

const config = {
  thingName: ambyteDevice.thingName,
  deviceType: "ambyte" as const,
  endpoint: "abc-ats.iot.eu-central-1.amazonaws.com",
  experiments: [
    {
      experimentId: "11111111-1111-4111-8111-111111111111",
      experimentName: "E",
      topicPrefix: "experiment/data_ingest/v1/11111111-1111-4111-8111-111111111111/ambyte",
      workbook: null,
    },
  ],
};

// Filenames of every <a download> the component would have triggered.
const downloads: string[] = [];

describe("DeviceConfigDelivery", () => {
  beforeEach(() => {
    downloads.length = 0;
    communication.isConnected = false;
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

  it("renders the endpoint and per-experiment topics", () => {
    render(<DeviceConfigDelivery device={ambyteDevice} config={config} />);

    expect(screen.getByText(config.endpoint)).toBeInTheDocument();
    expect(screen.getByText(config.experiments[0].topicPrefix)).toBeInTheDocument();
  });

  it("downloads the config as a JSON named after the device", async () => {
    const user = userEvent.setup();
    render(<DeviceConfigDelivery device={ambyteDevice} config={config} />);

    await user.click(screen.getByRole("button", { name: /iot.onboarding.download/ }));

    expect(downloads.at(-1)).toBe(`${ambyteDevice.thingName}-config.json`);
  });

  it("offers connect before pushing for a pushable family", () => {
    render(<DeviceConfigDelivery device={ambyteDevice} config={config} />);

    expect(screen.getByRole("button", { name: /iot.onboarding.connect/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /iot.onboarding.push/ })).not.toBeInTheDocument();
  });

  it("pushes the config through the device driver when connected", async () => {
    const user = userEvent.setup();
    communication.isConnected = true;
    render(<DeviceConfigDelivery device={ambyteDevice} config={config} />);

    await user.click(screen.getByRole("button", { name: /iot.onboarding.push/ }));

    await waitFor(() => {
      expect(deliverDeviceConfig).toHaveBeenCalledWith(communication.driver, {
        config: { ...config },
        id: config.thingName,
      });
    });
    expect(toast).toHaveBeenCalledWith({ title: "iot.onboarding.pushSuccess" });
  });

  it("is download-only for multispeq", () => {
    render(<DeviceConfigDelivery device={multispeqDevice} config={config} />);

    expect(screen.getByText("iot.onboarding.multispeqNote")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /iot.onboarding.connect/ }),
    ).not.toBeInTheDocument();
  });
});
