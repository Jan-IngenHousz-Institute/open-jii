import { assertExists, fireEvent, render, screen, waitFor } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import { FileText } from "lucide-react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { IotCredentialFile, downloadText, downloadZip } from "./iot-credential-file";

// Filenames of every <a download> the component would have triggered.
const downloads: string[] = [];

describe("IotCredentialFile", () => {
  beforeEach(() => {
    downloads.length = 0;
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      downloads.push(this.download);
    });
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the label and sublabel", () => {
    render(
      <IotCredentialFile
        icon={FileText}
        label="Certificate"
        sublabel="device.cert.pem"
        filename="device.cert.pem"
        content="PEM"
      />,
    );

    expect(screen.getByText("Certificate")).toBeInTheDocument();
    expect(screen.getByText("device.cert.pem")).toBeInTheDocument();
  });

  it("hides the copy button unless the file is copyable", () => {
    render(
      <IotCredentialFile
        icon={FileText}
        label="Root CA"
        sublabel="AmazonRootCA1.pem"
        filename="AmazonRootCA1.pem"
        content="CA"
      />,
    );

    expect(
      screen.queryByRole("button", { name: "iot.devices.credentials.copy" }),
    ).not.toBeInTheDocument();
  });

  it("copies the content to the clipboard when copy is clicked", async () => {
    render(
      <IotCredentialFile
        icon={FileText}
        label="Certificate"
        sublabel="device.cert.pem"
        filename="device.cert.pem"
        content="PEM-BODY"
        copyable
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "iot.devices.credentials.copy" }));

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith("PEM-BODY");
    });
  });

  it("downloads the file under its filename when download is clicked", async () => {
    const user = userEvent.setup();
    render(
      <IotCredentialFile
        icon={FileText}
        label="Certificate"
        sublabel="device.cert.pem"
        filename="device.cert.pem"
        content="PEM"
      />,
    );

    await user.click(screen.getByRole("button", { name: "iot.devices.credentials.download" }));

    expect(downloads.at(-1)).toBe("device.cert.pem");
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock");
  });

  it("downloadText saves a single named file", () => {
    downloadText("note.pem", "hello");

    expect(downloads.at(-1)).toBe("note.pem");
    expect(URL.createObjectURL).toHaveBeenCalled();
  });

  it("downloadZip bundles multiple files into one archive", () => {
    downloadZip("bundle.zip", [
      { filename: "a.pem", content: "AAA" },
      { filename: "b.key", content: "BBB" },
    ]);

    const blob = vi.mocked(URL.createObjectURL).mock.calls.at(-1)?.[0];
    assertExists(blob);
    expect(downloads.at(-1)).toBe("bundle.zip");
    expect(blob).toBeInstanceOf(Blob);
    expect(blob).toHaveProperty("type", "application/zip");
  });
});
