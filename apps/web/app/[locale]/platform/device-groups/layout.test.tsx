import { render, screen } from "@/test/test-utils";
import { notFound } from "next/navigation";
import { useFeatureFlagEnabled } from "posthog-js/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import DeviceGroupsLayout from "./layout";

const renderLayout = () =>
  render(
    <DeviceGroupsLayout>
      <div>Child Content</div>
    </DeviceGroupsLayout>,
  );

describe("<DeviceGroupsLayout />", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useFeatureFlagEnabled).mockReturnValue(true);
  });

  it("calls notFound when the iot-devices flag is disabled", () => {
    vi.mocked(useFeatureFlagEnabled).mockReturnValue(false);
    renderLayout();

    expect(notFound).toHaveBeenCalled();
  });

  it("renders nothing while the iot-devices flag is loading", () => {
    // A reset mock returns undefined, matching the flag's loading state.
    vi.mocked(useFeatureFlagEnabled).mockReset();
    renderLayout();

    expect(notFound).not.toHaveBeenCalled();
    expect(screen.queryByText("Child Content")).not.toBeInTheDocument();
  });

  it("renders children when the flag is enabled", () => {
    renderLayout();

    expect(screen.getByText("Child Content")).toBeInTheDocument();
  });
});
