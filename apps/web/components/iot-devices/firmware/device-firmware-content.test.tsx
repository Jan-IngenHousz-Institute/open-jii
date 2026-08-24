import { createIotDeviceDetail } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, waitFor } from "@/test/test-utils";
import { useParams } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";

import DeviceFirmwareContent from "./device-firmware-content";

const DEVICE_ID = "11111111-1111-4111-8111-111111111111";

function release(overrides: Record<string, unknown> = {}) {
  return {
    version: "v1.3.0",
    name: "Spring release",
    publishedAt: "2026-08-01T10:00:00.000Z",
    prerelease: false,
    latest: true,
    notesHtml: "<ul><li>fixes a thing</li></ul>",
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
  const history = server.mount(contract.iot.getDeviceFirmwareHistory, {
    body: {
      versions:
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
  const releases = server.mount(contract.iot.listIotFirmwareReleases, {
    body: { releases: options.releases ?? [release()] },
  });

  return { releases, history };
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

    expect(await screen.findByText("fixes a thing")).toBeInTheDocument();
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

  it("says the family has no firmware line when the backend has no repository for it", async () => {
    mountAll({ reportedVersion: "v1.3.0" });
    server.mount(contract.iot.listIotFirmwareReleases, { status: 404 });

    render(<DeviceFirmwareContent />);

    expect(await screen.findByText("iot.devices.firmware.noFirmwareLine")).toBeInTheDocument();
    // A configuration gap is not a failure, so the generic error stays away.
    expect(screen.queryByText("iot.devices.firmware.loadError")).not.toBeInTheDocument();
  });

  it("does not claim the device never reported while the scan is still running", async () => {
    mountAll({ reportedVersion: "v1.3.0" });
    server.mount(contract.iot.getDeviceFirmwareHistory, { delay: "infinite" });

    render(<DeviceFirmwareContent />);

    // The releases panel arrives first, so the tab is rendered and the version
    // line is the only thing still pending.
    expect(await screen.findByText("iot.devices.firmware.currentTitle")).toBeInTheDocument();
    expect(screen.queryByText("iot.devices.firmware.unknownVersion")).not.toBeInTheDocument();
    expect(screen.queryByText("iot.devices.firmware.versionUnavailable")).not.toBeInTheDocument();
  });

  it("admits the reported version could not be read when the scan fails", async () => {
    mountAll({ reportedVersion: "v1.3.0" });
    server.mount(contract.iot.getDeviceFirmwareHistory, { status: 500 });

    render(<DeviceFirmwareContent />);

    expect(await screen.findByText("iot.devices.firmware.versionUnavailable")).toBeInTheDocument();
    // Claiming the device never reported would be a different, false statement.
    expect(screen.queryByText("iot.devices.firmware.unknownVersion")).not.toBeInTheDocument();
  });

  it("sends a family with no JII firmware line back to the device", async () => {
    const { releases, history } = mountAll({ deviceType: "mobile" });

    const { container, router } = render(<DeviceFirmwareContent />);

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith(`/en-US/platform/devices/${DEVICE_ID}`);
    });
    expect(container).toBeEmptyDOMElement();
    // Neither the release read nor the warehouse scan is worth paying for a
    // family this device cannot run.
    expect(releases.called).toBe(false);
    expect(history.called).toBe(false);
  });
});
