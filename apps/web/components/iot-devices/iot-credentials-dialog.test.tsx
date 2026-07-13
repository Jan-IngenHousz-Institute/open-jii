import { render, screen } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { IotCredentialsDialog } from "./iot-credentials-dialog";

const CREDENTIALS = {
  certificateId: "c1",
  certificateArn: "arn:c1",
  certificatePem: "PEM",
  publicKey: "PUB",
  privateKey: "KEY",
};

describe("IotCredentialsDialog", () => {
  const downloads: string[] = [];

  beforeEach(() => {
    downloads.length = 0;
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

  it("renders the credential sections when credentials are present", () => {
    render(
      <IotCredentialsDialog
        thingName="ambyte_SN1"
        credentials={CREDENTIALS}
        onOpenChange={vi.fn()}
      />,
    );

    expect(screen.getByText("iot.devices.credentials.dialogTitle")).toBeInTheDocument();
    expect(screen.getByText("iot.devices.credentials.certificate")).toBeInTheDocument();
    expect(screen.getByText("iot.devices.credentials.privateKey")).toBeInTheDocument();
    expect(screen.getByText("iot.devices.credentials.rootCa1")).toBeInTheDocument();
  });

  it("bundles every credential into one zip named after the device", async () => {
    const user = userEvent.setup();
    render(
      <IotCredentialsDialog
        thingName="ambyte_SN1"
        credentials={CREDENTIALS}
        onOpenChange={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "iot.devices.credentials.downloadAll" }));

    expect(downloads.at(-1)).toBe("ambyte_SN1-credentials.zip");
    expect(URL.createObjectURL).toHaveBeenCalled();
  });

  it("closes when the close button is clicked", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <IotCredentialsDialog
        thingName="ambyte_SN1"
        credentials={CREDENTIALS}
        onOpenChange={onOpenChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: "common.close" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
