import { CalibrationFlagProvider } from "@/components/calibrations/calibration-flag-context";
import { render, screen } from "@/test/test-utils";
import { usePathname } from "next/navigation";
import { describe, expect, it, vi } from "vitest";

import { IotDeviceDetailTabs } from "./iot-device-detail-tabs";

const DEVICE_ID = "11111111-1111-4111-8111-111111111111";

function renderTabs(isCalibrationEnabled: boolean) {
  vi.mocked(usePathname).mockReturnValue(`/en-US/platform/devices/${DEVICE_ID}`);
  return render(
    <CalibrationFlagProvider isEnabled={isCalibrationEnabled}>
      <IotDeviceDetailTabs
        deviceId={DEVICE_ID}
        isMobileFamily={false}
        hasManagedFirmware={false}
        canShare
        canLeave={false}
        canManage
      >
        <p>tab content</p>
      </IotDeviceDetailTabs>
    </CalibrationFlagProvider>,
  );
}

describe("IotDeviceDetailTabs", () => {
  it("offers a manager the calibration tab while calibration is flagged on", () => {
    renderTabs(true);

    expect(screen.getByRole("tab", { name: "iot.devices.detailTabs.calibration" })).toHaveAttribute(
      "href",
      `/en-US/platform/devices/${DEVICE_ID}/calibration`,
    );
  });

  it("leaves the calibration tab out while calibration is flagged off", () => {
    renderTabs(false);

    expect(
      screen.getByRole("tab", { name: "iot.devices.detailTabs.overview" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "iot.devices.detailTabs.calibration" })).toBeNull();
  });
});
