import { render, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import type { FirmwareRelease } from "@repo/api/domains/iot/firmware/iot-firmware.schema";

import { FirmwareReleaseList } from "./firmware-release-list";

function release(overrides: Partial<FirmwareRelease> = {}): FirmwareRelease {
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

describe("FirmwareReleaseList", () => {
  it("says so when a family has published nothing", () => {
    render(<FirmwareReleaseList releases={[]} installedVersion={null} />);

    expect(screen.getByText("iot.devices.firmware.noReleases")).toBeInTheDocument();
  });

  it("marks the latest, prereleases and the version on this device", () => {
    render(
      <FirmwareReleaseList
        releases={[
          release({ version: "v1.4.0-rc1", prerelease: true, latest: false }),
          release({ version: "v1.3.0", latest: true }),
          release({ version: "v1.2.0", latest: false }),
        ]}
        installedVersion="v1.2.0"
      />,
    );

    expect(screen.getByText("iot.devices.firmware.prerelease")).toBeInTheDocument();
    expect(screen.getByText("iot.devices.firmware.latest")).toBeInTheDocument();
    // The badge lands on the version the device reported, not the newest one.
    expect(screen.getByText("iot.devices.firmware.installed")).toBeInTheDocument();
  });

  it("shows the asset with a human-readable size and links to the release", () => {
    render(<FirmwareReleaseList releases={[release()]} installedVersion={null} />);

    const asset = screen.getByRole("link", { name: /firmware\.bin/ });
    expect(asset).toHaveAttribute(
      "href",
      "https://github.com/org/repo/releases/download/v1.3.0/firmware.bin",
    );
    expect(screen.getByText("(2 KB)")).toBeInTheDocument();

    const source = screen.getByRole("link", { name: /viewOnGitHub/ });
    expect(source).toHaveAttribute("href", "https://github.com/org/repo/releases/tag/v1.3.0");
    expect(source).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("says when a release carries no notes", () => {
    render(<FirmwareReleaseList releases={[release({ notes: null })]} installedVersion={null} />);

    expect(screen.getByText("iot.devices.firmware.noNotes")).toBeInTheDocument();
  });

  it("collapses long notes behind a toggle and reveals the rest on request", async () => {
    const user = userEvent.setup();
    const notes = Array.from({ length: 12 }, (_, index) => `line ${String(index)}`).join("\n");
    render(<FirmwareReleaseList releases={[release({ notes })]} installedVersion={null} />);

    // The tail is present but hidden until the toggle is used.
    expect(screen.queryByText(/line 11/)).not.toBeInTheDocument();

    await user.click(screen.getByText("iot.devices.firmware.showAllNotes"));

    expect(screen.getByText(/line 11/)).toBeInTheDocument();
  });

  it("shows short notes without a toggle", () => {
    render(
      <FirmwareReleaseList releases={[release({ notes: "one\ntwo" })]} installedVersion={null} />,
    );

    expect(screen.getByText(/one/)).toBeInTheDocument();
    expect(screen.queryByText("iot.devices.firmware.showAllNotes")).not.toBeInTheDocument();
  });
});
