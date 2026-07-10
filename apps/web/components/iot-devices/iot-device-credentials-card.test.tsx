import { createIotDevice } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, waitFor, within } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";

import { contract } from "@repo/api/contract";

import { IotDeviceCredentialsCard } from "./iot-device-credentials-card";

const CERT = {
  certificateId: "c1",
  certificateArn: "arn:c1",
  certificatePem: "PEM",
  publicKey: "PUB",
  privateKey: "KEY",
};

describe("IotDeviceCredentialsCard", () => {
  it("issues a certificate and shows the one-time bundle for a pending device", async () => {
    const user = userEvent.setup();
    server.mount(contract.iot.issueIotCredentials, { status: 201, body: CERT });
    render(<IotDeviceCredentialsCard device={createIotDevice({ status: "pending" })} />);

    await user.click(screen.getByRole("button", { name: "iot.devices.credentials.issue" }));

    await waitFor(() => {
      expect(screen.getByText("iot.devices.credentials.dialogTitle")).toBeInTheDocument();
    });
    expect(screen.getByText("iot.devices.credentials.certificate")).toBeInTheDocument();
    expect(screen.getByText("iot.devices.credentials.publicKey")).toBeInTheDocument();
    expect(screen.getByText("iot.devices.credentials.privateKey")).toBeInTheDocument();
    // Both root CAs are offered, like the AWS console.
    expect(screen.getByText("iot.devices.credentials.rootCa1")).toBeInTheDocument();
    expect(screen.getByText("iot.devices.credentials.rootCa3")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "iot.devices.credentials.downloadAll" }),
    ).toBeInTheDocument();
  });

  it("offers rotate and revoke for an active device", () => {
    render(
      <IotDeviceCredentialsCard
        device={createIotDevice({ status: "active", certificateId: "cert-x" })}
      />,
    );

    expect(
      screen.getByRole("button", { name: "iot.devices.credentials.rotate" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "iot.devices.credentials.revoke" }),
    ).toBeInTheDocument();
    expect(screen.getByText("cert-x")).toBeInTheDocument();
  });

  it("revokes an active device's certificate", async () => {
    const user = userEvent.setup();
    server.mount(contract.iot.revokeIotCredentials, {
      status: 200,
      body: createIotDevice({ status: "revoked" }),
    });
    render(
      <IotDeviceCredentialsCard
        device={createIotDevice({ status: "active", certificateId: "cert-x" })}
      />,
    );

    await user.click(screen.getByRole("button", { name: "iot.devices.credentials.revoke" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(
      within(dialog).getByRole("button", { name: "iot.devices.credentials.revoke" }),
    );

    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });
  });

  it("offers re-issue for a revoked device", () => {
    render(<IotDeviceCredentialsCard device={createIotDevice({ status: "revoked" })} />);

    expect(screen.getByText("iot.devices.credentials.revokedDescription")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "iot.devices.credentials.reissue" }),
    ).toBeInTheDocument();
  });
});
