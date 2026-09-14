import { createIotDeviceDetail } from "@/test/factories";
import { render, screen } from "@/test/test-utils";
import { usePathname } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { IotDeviceLayoutContent } from "./iot-device-layout-content";

beforeEach(() => {
  vi.mocked(usePathname).mockReturnValue("/en-US/platform/devices/device-1/onboarding");
});

describe("IotDeviceLayoutContent", () => {
  it("lets a long unbroken device name wrap without widening the phone layout", () => {
    const { container } = render(
      <IotDeviceLayoutContent
        deviceId="device-1"
        device={createIotDeviceDetail({
          name: "AMBYTE_28:37:2F:FF:E7:04_WITH_A_LONG_UNBROKEN_SUFFIX",
        })}
      >
        <p>tab body</p>
      </IotDeviceLayoutContent>,
    );

    const heading = screen.getByRole("heading", { level: 1 });
    expect(container.firstElementChild).toHaveClass("min-w-0");
    expect(heading.parentElement).toHaveClass("min-w-0", "flex-1", "basis-full");
    expect(heading).toHaveClass("min-w-0", "break-words");
    expect(container.querySelector('[data-slot="device-status-summary"]')).toHaveClass(
      "w-full",
      "xl:w-auto",
    );
    expect(screen.getByText("tab body")).toBeInTheDocument();
  });
});
