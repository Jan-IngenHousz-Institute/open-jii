import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { deviceRung } from "./device-rung";
import { IotDeviceStatusBadge } from "./iot-device-status-badge";

describe("deviceRung", () => {
  it("reads a credentialed device with no experiment as provisioned", () => {
    expect(deviceRung("active", 0)).toBe("provisioned");
  });

  it("reads a credentialed device on an experiment as onboarded", () => {
    expect(deviceRung("active", 1)).toBe("onboarded");
    expect(deviceRung("active", 7)).toBe("onboarded");
  });

  it("passes every other status through untouched, whatever the bindings say", () => {
    expect(deviceRung("registered", 3)).toBe("registered");
    expect(deviceRung("revoked", 3)).toBe("revoked");
    expect(deviceRung("retired", 3)).toBe("retired");
  });
});

describe("IotDeviceStatusBadge", () => {
  it("never shows the stored word active, only the rung it resolves to", () => {
    render(<IotDeviceStatusBadge status="active" deviceType="ambyte" boundExperimentCount={0} />);

    expect(screen.getByText("iot.devices.status.provisioned")).toBeInTheDocument();
    expect(screen.queryByText("iot.devices.status.active")).not.toBeInTheDocument();
  });

  it("shows onboarded once a binding exists", () => {
    render(<IotDeviceStatusBadge status="active" deviceType="ambyte" boundExperimentCount={2} />);

    expect(screen.getByText("iot.devices.status.onboarded")).toBeInTheDocument();
  });

  it("shows nothing for a phone, which has no ladder to climb", () => {
    const { container } = render(
      <IotDeviceStatusBadge status="active" deviceType="mobile" boundExperimentCount={0} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("still says retired on a phone, since that was an operator's decision", () => {
    render(<IotDeviceStatusBadge status="retired" deviceType="mobile" boundExperimentCount={0} />);

    expect(screen.getByText("iot.devices.status.retired")).toBeInTheDocument();
  });
});
