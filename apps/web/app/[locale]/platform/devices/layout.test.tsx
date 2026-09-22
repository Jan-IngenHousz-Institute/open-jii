import { render, screen } from "@/test/test-utils";
import { usePathname } from "next/navigation";
import { describe, it, expect, vi, beforeEach } from "vitest";

import DevicesLayout from "./layout";

const renderLayout = (children: React.ReactNode = <div>Child Content</div>) =>
  render(<DevicesLayout>{children}</DevicesLayout>);

describe("<DevicesLayout />", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
