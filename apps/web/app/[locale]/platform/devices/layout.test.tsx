import { render, screen } from "@/test/test-utils";
import { notFound, usePathname } from "next/navigation";
import { useFeatureFlagEnabled } from "posthog-js/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import DevicesLayout from "./layout";

const renderLayout = (children: React.ReactNode = <div>Child Content</div>) =>
  render(<DevicesLayout>{children}</DevicesLayout>);

describe("<DevicesLayout />", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useFeatureFlagEnabled).mockReturnValue(true);
  });

  it("calls notFound when the iot-devices flag is disabled", () => {
    vi.mocked(useFeatureFlagEnabled).mockReturnValue(false);
    vi.mocked(usePathname).mockReturnValue("/en-US/platform/devices");
    renderLayout();

    expect(notFound).toHaveBeenCalled();
  });

  it("renders nothing while the iot-devices flag is loading", () => {
    vi.mocked(useFeatureFlagEnabled).mockReturnValue(undefined as unknown as boolean);
    vi.mocked(usePathname).mockReturnValue("/en-US/platform/devices");
    renderLayout();

    expect(notFound).not.toHaveBeenCalled();
    expect(screen.queryByText("Child Content")).not.toBeInTheDocument();
  });

  it("renders the list content without repeating the shell heading", () => {
    vi.mocked(usePathname).mockReturnValue("/en-US/platform/devices");
    renderLayout();

    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
    expect(screen.getByText("Child Content")).toBeInTheDocument();
  });

  it("renders children only (no header) on a device detail route", () => {
    vi.mocked(usePathname).mockReturnValue("/en-US/platform/devices/dev-1");
    renderLayout();

    expect(screen.getByText("Child Content")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
  });
});
