import { render, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { DeviceIdentity, DeviceRow } from "./device-row";
import type { DeviceRowDevice } from "./device-row";

const device: DeviceRowDevice = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Greenhouse gateway 01",
  serialNumber: "AA:BB:CC:01",
  deviceType: "ambyte",
};

describe("DeviceIdentity", () => {
  it("shows the device name", () => {
    render(<DeviceIdentity device={device} />);

    expect(screen.getByText("Greenhouse gateway 01")).toBeInTheDocument();
  });

  it("falls back to the serial for an unnamed device", () => {
    render(<DeviceIdentity device={{ ...device, name: null }} />);

    // Documented precedence: a serial distinguishes forty unnamed devices
    // where a shared product name cannot.
    expect(screen.getByText("AA:BB:CC:01")).toBeInTheDocument();
  });

  it("treats a blank name as no name, which `name ?? serialNumber` does not", () => {
    render(<DeviceIdentity device={{ ...device, name: "   " }} />);

    expect(screen.getByText("AA:BB:CC:01")).toBeInTheDocument();
  });

  it("links the name only when given an href", () => {
    const { rerender } = render(<DeviceIdentity device={device} />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();

    rerender(<DeviceIdentity device={device} href="/en-US/platform/devices/x" />);
    expect(screen.getByRole("link", { name: "Greenhouse gateway 01" })).toHaveAttribute(
      "href",
      "/en-US/platform/devices/x",
    );
  });

  it("shows the serial as a second line only when asked", () => {
    const { rerender } = render(<DeviceIdentity device={device} />);
    expect(screen.queryByText("AA:BB:CC:01")).not.toBeInTheDocument();

    rerender(<DeviceIdentity device={device} showSerial />);
    expect(screen.getByText("AA:BB:CC:01")).toBeInTheDocument();
  });
});

describe("DeviceRow", () => {
  it("renders identity, family, status and trailing in that order", () => {
    render(
      <DeviceRow
        device={device}
        status={<span>Active</span>}
        trailing={<button type="button">Menu</button>}
      />,
    );

    expect(screen.getByText("Greenhouse gateway 01")).toBeInTheDocument();
    expect(screen.getByText(/ambyte/i)).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Menu" })).toBeInTheDocument();
  });

  it("drops the serial line in compact density, where there is no room", () => {
    const { rerender } = render(<DeviceRow device={device} />);
    expect(screen.getByText("AA:BB:CC:01")).toBeInTheDocument();

    rerender(<DeviceRow device={device} density="compact" />);
    expect(screen.queryByText("AA:BB:CC:01")).not.toBeInTheDocument();
  });

  it("hides the family where the surface is already single-family", () => {
    render(<DeviceRow device={device} hideFamily />);

    expect(screen.queryByText(/ambyte/i)).not.toBeInTheDocument();
  });

  it("toggles from anywhere on a selectable row, not just the checkbox", async () => {
    const onCheckedChange = vi.fn();
    const user = userEvent.setup();
    render(<DeviceRow device={device} selection={{ checked: false, onCheckedChange }} />);

    await user.click(screen.getByText("Greenhouse gateway 01"));

    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it("does not toggle a disabled selection", async () => {
    const onCheckedChange = vi.fn();
    const user = userEvent.setup();
    render(
      <DeviceRow device={device} selection={{ checked: false, disabled: true, onCheckedChange }} />,
    );

    await user.click(screen.getByText("Greenhouse gateway 01"));

    expect(onCheckedChange).not.toHaveBeenCalled();
  });

  it("renders no checkbox at all when the row is not selectable", () => {
    render(<DeviceRow device={device} />);

    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });
});
