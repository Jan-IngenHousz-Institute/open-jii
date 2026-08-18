import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { GroupComingSoon } from "./group-coming-soon";

describe("GroupComingSoon", () => {
  it("renders the section-specific description", () => {
    render(<GroupComingSoon section="credentials" />);

    expect(screen.getByText("iot.devices.comingSoon.title")).toBeInTheDocument();
    expect(screen.getByText("iot.groups.comingSoon.credentials")).toBeInTheDocument();
  });

  it("keys the description off the given section", () => {
    render(<GroupComingSoon section="onboarding" />);

    expect(screen.getByText("iot.groups.comingSoon.onboarding")).toBeInTheDocument();
  });
});
