import { render, screen, userEvent } from "@/test/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GroupCredentialResults } from "./group-credential-results";
import type { GroupCredentialBatch } from "./group-credential-results";

const DEVICE_ID = "11111111-1111-4111-8111-111111111111";

const CERT = {
  certificateId: "c1",
  certificateArn: "arn:c1",
  certificatePem: "PEM",
  publicKey: "PUB",
  privateKey: "KEY",
};

const downloads: string[] = [];

function renderResults(batch: GroupCredentialBatch) {
  return render(
    <GroupCredentialResults
      groupName="Field / trial"
      batch={batch}
      labelByDeviceId={new Map([[DEVICE_ID, "Gateway"]])}
    />,
  );
}

describe("GroupCredentialResults", () => {
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

  it("downloads one device's bundle under its thing name", async () => {
    const user = userEvent.setup();
    renderResults({
      action: "issue",
      rows: [{ deviceId: DEVICE_ID, thingName: "ambyte_GW-1", credentials: CERT, error: null }],
    });

    expect(screen.getByText("iot.devices.credentials.showOnceWarning")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "iot.groups.credentials.downloadOne" }));

    expect(downloads).toEqual(["ambyte_GW-1-credentials.zip"]);
  });

  it("zips every issued bundle under a filesystem-safe group name", async () => {
    const user = userEvent.setup();
    renderResults({
      action: "rotate",
      rows: [
        { deviceId: DEVICE_ID, thingName: "ambyte_GW-1", credentials: CERT, error: null },
        {
          deviceId: "22222222-2222-4222-8222-222222222222",
          thingName: "ambyte_GW-2",
          credentials: null,
          error: "still rotating",
        },
      ],
    });

    // The failed row is reported inline and contributes nothing to the zip.
    expect(screen.getByText("still rotating")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /iot.groups.credentials.downloadAll/ }));

    expect(downloads).toEqual(["Field-trial-credentials.zip"]);
  });

  it("reports revocations without offering any download", () => {
    renderResults({
      action: "revoke",
      rows: [
        { deviceId: DEVICE_ID, error: null },
        { deviceId: "22222222-2222-4222-8222-222222222222", error: "not a member" },
      ],
    });

    expect(screen.getByText("Gateway")).toBeInTheDocument();
    expect(screen.getByText("not a member")).toBeInTheDocument();
    expect(screen.queryByText("iot.devices.credentials.showOnceWarning")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
