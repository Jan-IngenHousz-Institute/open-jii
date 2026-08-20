import { createIotDevice } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, waitFor, within } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import { toast } from "@repo/ui/hooks/use-toast";

import { IotDeviceCredentialsCard } from "./iot-device-credentials-card";

vi.mock("@repo/ui/hooks/use-toast", () => ({ toast: vi.fn() }));

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

  it("rotates an active device's certificate after confirmation and shows the new bundle", async () => {
    const user = userEvent.setup();
    server.mount(contract.iot.rotateIotCredentials, { status: 201, body: CERT });
    render(
      <IotDeviceCredentialsCard
        device={createIotDevice({ status: "active", certificateId: "cert-x" })}
      />,
    );

    await user.click(screen.getByRole("button", { name: "iot.devices.credentials.rotate" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("iot.devices.credentials.rotateConfirm")).toBeInTheDocument();
    await user.click(
      within(dialog).getByRole("button", { name: "iot.devices.credentials.rotate" }),
    );

    await waitFor(() => {
      expect(screen.getByText("iot.devices.credentials.dialogTitle")).toBeInTheDocument();
    });
  });

  it("warns that a connected device will disconnect before rotating", async () => {
    const user = userEvent.setup();
    render(
      <IotDeviceCredentialsCard
        device={createIotDevice({
          status: "active",
          certificateId: "cert-x",
          connectivity: { connected: true, lastSeenAt: null },
        })}
      />,
    );

    await user.click(screen.getByRole("button", { name: "iot.devices.credentials.rotate" }));

    const dialog = await screen.findByRole("alertdialog");
    expect(
      within(dialog).getByText("iot.devices.credentials.disconnectWarning"),
    ).toBeInTheDocument();
  });

  it("skips the disconnect warning when the device is offline", async () => {
    const user = userEvent.setup();
    render(
      <IotDeviceCredentialsCard
        device={createIotDevice({
          status: "active",
          certificateId: "cert-x",
          connectivity: { connected: false, lastSeenAt: null },
        })}
      />,
    );

    await user.click(screen.getByRole("button", { name: "iot.devices.credentials.revoke" }));

    const dialog = await screen.findByRole("alertdialog");
    expect(
      within(dialog).queryByText("iot.devices.credentials.disconnectWarning"),
    ).not.toBeInTheDocument();
  });

  it("shows a rotating notice for a device mid-rotation", () => {
    render(<IotDeviceCredentialsCard device={createIotDevice({ status: "rotating" })} />);

    expect(screen.getByText("iot.devices.credentials.rotatingDescription")).toBeInTheDocument();
  });

  it("dismisses the credential dialog when it is closed", async () => {
    const user = userEvent.setup();
    server.mount(contract.iot.issueIotCredentials, { status: 201, body: CERT });
    render(<IotDeviceCredentialsCard device={createIotDevice({ status: "pending" })} />);

    await user.click(screen.getByRole("button", { name: "iot.devices.credentials.issue" }));
    await screen.findByText("iot.devices.credentials.dialogTitle");

    await user.click(screen.getByRole("button", { name: "common.close" }));

    await waitFor(() => {
      expect(screen.queryByText("iot.devices.credentials.dialogTitle")).not.toBeInTheDocument();
    });
  });

  it("shows an error toast when issuing fails", async () => {
    const user = userEvent.setup();
    server.mount(contract.iot.issueIotCredentials, { status: 500, body: { message: "Nope" } });
    render(<IotDeviceCredentialsCard device={createIotDevice({ status: "pending" })} />);

    await user.click(screen.getByRole("button", { name: "iot.devices.credentials.issue" }));

    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" }));
    });
  });

  it("shows an error toast when revoking fails", async () => {
    const user = userEvent.setup();
    server.mount(contract.iot.revokeIotCredentials, { status: 500, body: { message: "Nope" } });
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
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" }));
    });
  });
});
