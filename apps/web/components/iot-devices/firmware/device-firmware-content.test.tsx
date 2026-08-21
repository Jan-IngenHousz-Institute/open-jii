import { createIotDeviceDetail } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, waitFor } from "@/test/test-utils";
import { useParams } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import type { DeviceMonitoring } from "@repo/api/domains/iot/iot.schema";

import DeviceFirmwareContent from "./device-firmware-content";

const DEVICE_ID = "11111111-1111-4111-8111-111111111111";

const EMPTY_MONITORING: DeviceMonitoring = {
  bucket: "day",
  events: [],
  sessions: [],
  uptimePercent: null,
  truncated: false,
  throughput: [],
  battery: [],
  payload: {
    totalMeasurements: 0,
    withGps: 0,
    withBattery: 0,
    workbookRuns: 0,
    firmwareMix: [],
    protocolMix: [],
    workbookMix: [],
    macroMix: [],
  },
  firmwareHistory: [],
  recentMeasurements: [],
};

function release(overrides: Record<string, unknown> = {}) {
  return {
    version: "v1.3.0",
    name: "Spring release",
    publishedAt: "2026-08-01T10:00:00.000Z",
    prerelease: false,
    latest: true,
    notes: "- fixes a thing",
    releaseUrl: "https://github.com/org/repo/releases/tag/v1.3.0",
    assets: [
      {
        name: "firmware.bin",
        sizeBytes: 2048,
        downloadUrl: "https://github.com/org/repo/releases/download/v1.3.0/firmware.bin",
      },
    ],
    ...overrides,
  };
}

function mountAll(
  options: {
    deviceType?: "ambyte" | "mobile" | "multispeq";
    reportedVersion?: string | null;
    releases?: ReturnType<typeof release>[];
  } = {},
) {
  server.mount(contract.iot.getIotDevice, {
    body: createIotDeviceDetail({ id: DEVICE_ID, deviceType: options.deviceType ?? "ambyte" }),
  });
  server.mount(contract.iot.getDeviceMonitoring, {
    body: {
      ...EMPTY_MONITORING,
      firmwareHistory:
        options.reportedVersion === undefined || options.reportedVersion === null
          ? []
          : [
              {
                version: options.reportedVersion,
                firstSeen: "2026-08-01T00:00:00.000Z",
                lastSeen: "2026-08-14T00:00:00.000Z",
                count: 5,
              },
            ],
    },
  });
  server.mount(contract.iot.listIotFirmwareReleases, {
    body: { releases: options.releases ?? [release()] },
  });
}

beforeEach(() => {
  vi.mocked(useParams).mockReturnValue({ deviceId: DEVICE_ID });
});

describe("DeviceFirmwareContent", () => {
  it("says the device is current when it reports the newest release", async () => {
    mountAll({ reportedVersion: "v1.3.0" });

    render(<DeviceFirmwareContent />);

    expect(await screen.findByText("iot.devices.firmware.upToDate")).toBeInTheDocument();
    expect(screen.getByText("iot.devices.firmware.latest")).toBeInTheDocument();
    expect(screen.getByText("iot.devices.firmware.installed")).toBeInTheDocument();
  });

  it("flags an available update when the device is behind", async () => {
    mountAll({ reportedVersion: "v1.2.0" });

    render(<DeviceFirmwareContent />);

    expect(await screen.findByText("iot.devices.firmware.updateAvailable")).toBeInTheDocument();
  });

  it("admits it does not know the version when the device has not reported", async () => {
    mountAll({ reportedVersion: null });

    render(<DeviceFirmwareContent />);

    expect(await screen.findByText("iot.devices.firmware.unknownVersion")).toBeInTheDocument();
  });

  it("renders release notes, assets and the delivery guide", async () => {
    mountAll({ reportedVersion: "v1.3.0" });

    render(<DeviceFirmwareContent />);

    expect(await screen.findByText("- fixes a thing")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /firmware.bin/ })).toBeInTheDocument();
    expect(screen.getByText("iot.devices.firmware.guide.title")).toBeInTheDocument();
  });

  it("shows an empty state when the family has no published releases", async () => {
    mountAll({ reportedVersion: "v1.3.0", releases: [] });

    render(<DeviceFirmwareContent />);

    expect(await screen.findByText("iot.devices.firmware.noReleases")).toBeInTheDocument();
  });

  it("reports a failure to read releases without blanking the tab", async () => {
    mountAll({ reportedVersion: "v1.3.0" });
    server.mount(contract.iot.listIotFirmwareReleases, { status: 500 });

    render(<DeviceFirmwareContent />);

    expect(await screen.findByText("iot.devices.firmware.loadError")).toBeInTheDocument();
    expect(screen.getByText("iot.devices.firmware.currentTitle")).toBeInTheDocument();
  });

  it("sends a family with no JII firmware line back to the device", async () => {
    mountAll({ deviceType: "mobile" });

    const { container, router } = render(<DeviceFirmwareContent />);

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith(`/en-US/platform/devices/${DEVICE_ID}`);
    });
    expect(container).toBeEmptyDOMElement();
  });
});
