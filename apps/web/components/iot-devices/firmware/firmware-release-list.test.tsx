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

  it("shows sub-kilobyte assets in bytes rather than rounding them up to 1 KB", () => {
    render(
      <FirmwareReleaseList
        releases={[
          release({
            assets: [
              { name: "empty.sig", sizeBytes: 0, downloadUrl: "https://example.test/empty.sig" },
              { name: "one.txt", sizeBytes: 1, downloadUrl: "https://example.test/one.txt" },
              { name: "just-under.bin", sizeBytes: 1023, downloadUrl: "https://example.test/u" },
              { name: "exactly.bin", sizeBytes: 1024, downloadUrl: "https://example.test/e" },
            ],
          }),
        ]}
        installedVersion={null}
      />,
    );

    expect(screen.getByText("(0 B)")).toBeInTheDocument();
    expect(screen.getByText("(1 B)")).toBeInTheDocument();
    expect(screen.getByText("(1023 B)")).toBeInTheDocument();
    expect(screen.getByText("(1 KB)")).toBeInTheDocument();
  });

  it("says when a release carries no notes", () => {
    render(
      <FirmwareReleaseList releases={[release({ notesHtml: null })]} installedVersion={null} />,
    );

    expect(screen.getByText("iot.devices.firmware.noNotes")).toBeInTheDocument();
  });

  it("renders the notes as GitHub's HTML, not raw markdown source", () => {
    render(<FirmwareReleaseList releases={[release()]} installedVersion={null} />);

    expect(screen.getByText("fixes a thing")).toBeInTheDocument();
    expect(screen.queryByText(/<li>/)).not.toBeInTheDocument();
  });

  it("clamps long notes behind a fade and expands them on request", async () => {
    const user = userEvent.setup();
    const notesHtml = `<ul>${Array.from({ length: 12 }, (_, index) => `<li>line ${String(index)}</li>`).join("")}</ul>`;
    render(<FirmwareReleaseList releases={[release({ notesHtml })]} installedVersion={null} />);

    // Every block stays in the DOM (the clamp is visual), but the toggle must
    // offer the rest and flip its label once used.
    await user.click(screen.getByText("iot.devices.firmware.showAllNotes"));

    expect(screen.getByText("iot.devices.firmware.showLessNotes")).toBeInTheDocument();
    expect(screen.getByText("line 11")).toBeInTheDocument();
  });

  it("shows short notes without a toggle", () => {
    render(
      <FirmwareReleaseList
        releases={[release({ notesHtml: "<p>one</p><p>two</p>" })]}
        installedVersion={null}
      />,
    );

    expect(screen.getByText(/one/)).toBeInTheDocument();
    expect(screen.queryByText("iot.devices.firmware.showAllNotes")).not.toBeInTheDocument();
  });

  it("skips a release name that just repeats the tag", () => {
    render(
      <FirmwareReleaseList
        releases={[release({ name: "v1.3.0", version: "v1.3.0" })]}
        installedVersion={null}
      />,
    );

    expect(screen.getAllByText("v1.3.0")).toHaveLength(1);
  });
});
