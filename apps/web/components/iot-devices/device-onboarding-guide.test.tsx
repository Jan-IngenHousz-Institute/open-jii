import { render, screen } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { DeviceOnboardingGuide } from "./device-onboarding-guide";

describe("DeviceOnboardingGuide", () => {
  it("expands to the connection steps and the full docs link", async () => {
    const user = userEvent.setup();
    render(<DeviceOnboardingGuide />);

    await user.click(screen.getByText("iot.onboarding.guide.title"));

    expect(screen.getByText("iot.onboarding.guide.step1")).toBeInTheDocument();
    expect(screen.getByText("iot.onboarding.guide.step6")).toBeInTheDocument();

    const link = screen.getByRole("link", { name: "iot.onboarding.guide.docsLink" });
    expect(link).toHaveAttribute("href", expect.stringContaining("/developers/device-integration"));
  });
});
