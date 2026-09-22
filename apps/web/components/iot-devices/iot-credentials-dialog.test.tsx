import { render, screen } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { IotCredentialsDialog } from "./iot-credentials-dialog";

const DEVICE_ID = "11111111-1111-4111-8111-111111111111";

const CREDENTIALS = {
  certificateId: "c1",
  certificateArn: "arn:c1",
  certificatePem: "PEM",
  publicKey: "PUB",
  privateKey: "KEY",
};

function renderDialog(onOpenChange = vi.fn()) {
  render(
    <IotCredentialsDialog
      deviceId={DEVICE_ID}
      thingName="ambyte_SN1"
      credentials={CREDENTIALS}
      onOpenChange={onOpenChange}
    />,
  );
  return onOpenChange;
}

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

  it("renders the sections with the show-once warning covering the whole bundle", () => {
    renderDialog();

    expect(screen.getByText("iot.devices.credentials.dialogTitle")).toBeInTheDocument();
    expect(screen.getByText("iot.devices.credentials.certificate")).toBeInTheDocument();
    expect(screen.getByText("iot.devices.credentials.privateKey")).toBeInTheDocument();
    expect(screen.getByText("iot.devices.credentials.rootCa1")).toBeInTheDocument();
    expect(screen.getByText("iot.devices.credentials.showOnceWarning")).toBeInTheDocument();
  });

  it("downloads the bundle, then hands off to onboarding", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole("button", { name: /iot.devices.credentials.downloadAll/ }));

    expect(downloads.at(-1)).toBe("ambyte_SN1-credentials.zip");
    // The primary's next job is the next step, not another download.
    const handoff = screen.getByRole("link", {
      name: /iot.devices.credentials.continueToOnboarding/,
    });
    expect(handoff).toHaveAttribute("href", `/en-US/platform/devices/${DEVICE_ID}/onboarding`);
  });

  it("asks before closing when nothing was downloaded", async () => {
    const user = userEvent.setup();
    const onOpenChange = renderDialog();

    await user.click(screen.getByRole("button", { name: "common.close" }));

    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByText("iot.devices.credentials.closeUnsavedTitle")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "iot.devices.credentials.closeUnsavedConfirm" }),
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("closes without asking once any file reached disk", async () => {
    const user = userEvent.setup();
    const onOpenChange = renderDialog();

    // One individual file download is enough; the confirm exists to catch a
    // bundle that never touched disk at all.
    await user.click(
      screen.getAllByRole("button", { name: /iot.devices.credentials.download$/ })[0],
    );
    await user.click(screen.getByRole("button", { name: "common.close" }));

    expect(screen.queryByText("iot.devices.credentials.closeUnsavedTitle")).not.toBeInTheDocument();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
