import { render, screen } from "@/test/test-utils";
import { usePathname } from "next/navigation";
import { describe, it, expect, vi, beforeEach } from "vitest";

import DevicesLayout from "./layout";

const renderLayout = async (children: React.ReactNode = <div>Child Content</div>) =>
  render(await DevicesLayout({ children, params: Promise.resolve({ locale: "en-US" }) }));

describe("<DevicesLayout />", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the list content without repeating the shell heading", async () => {
    vi.mocked(usePathname).mockReturnValue("/en-US/platform/devices");
    await renderLayout();

    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
    expect(screen.getByText("Child Content")).toBeInTheDocument();
  });

  it("renders children only (no header) on a device detail route", async () => {
    vi.mocked(usePathname).mockReturnValue("/en-US/platform/devices/dev-1");
    await renderLayout();

    expect(screen.getByText("Child Content")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
  });
});
