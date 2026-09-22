import { createIotDevice } from "@/test/factories";
import { render, screen } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CalibrationDevicePicker } from "./calibration-device-picker";

function renderPicker(props: Partial<Parameters<typeof CalibrationDevicePicker>[0]> = {}) {
  const onSelect = vi.fn();
  render(
    <CalibrationDevicePicker
      devices={[]}
      isLoading={false}
      isError={false}
      selectedId={null}
      onSelect={onSelect}
      {...props}
    />,
  );
  return { onSelect };
}

describe("CalibrationDevicePicker", () => {
  // Two units of a model carry the same name often enough that the serial is the identity.
  it("lists each candidate by name over its serial", () => {
    renderPicker({
      devices: [
        createIotDevice({ name: "Ambit 14", serialNumber: "AA:BB:CC:DD:EE:01" }),
        createIotDevice({ name: "Ambit 15", serialNumber: "AA:BB:CC:DD:EE:02" }),
      ],
    });

    expect(screen.getByText("Ambit 14")).toBeInTheDocument();
    expect(screen.getByText("AA:BB:CC:DD:EE:02")).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(2);
  });

  it("reports the device the author picked", async () => {
    const device = createIotDevice({ name: "Ambit 14" });
    const { onSelect } = renderPicker({ devices: [device] });

    await userEvent.click(screen.getByRole("radio"));

    expect(onSelect).toHaveBeenCalledWith(device.id);
  });

  it("marks the current choice, so a run is never recorded against an unseen device", () => {
    const device = createIotDevice();
    renderPicker({ devices: [device], selectedId: device.id });

    expect(screen.getByRole("radio")).toBeChecked();
  });

  it("says the fleet holds nothing of this family rather than offering an empty list", () => {
    renderPicker({ devices: [] });

    expect(screen.getByText("iot.calibration.trial.noDevices")).toBeInTheDocument();
  });

  it("distinguishes a fleet that has not answered from one that failed", () => {
    const { unmount } = render(
      <CalibrationDevicePicker
        devices={undefined}
        isLoading
        isError={false}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.queryByText("iot.calibration.loadError")).not.toBeInTheDocument();
    unmount();

    renderPicker({ devices: undefined, isError: true });
    expect(screen.getByText("iot.calibration.loadError")).toBeInTheDocument();
  });
});
