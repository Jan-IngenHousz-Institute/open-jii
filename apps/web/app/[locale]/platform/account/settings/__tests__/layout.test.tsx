import { render, screen } from "@/test/test-utils";
import { headers } from "next/headers";
import { describe, it, expect, vi, beforeEach } from "vitest";

import AccountSettingsLayout from "../layout";

describe("AccountSettingsLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function renderLayout(
    pathname = "/en-US/platform/account/settings",
    children = <div>Child Content</div>,
  ) {
    vi.mocked(headers).mockResolvedValue({
      get: vi.fn().mockReturnValue(pathname),
    } as never);

    return render(
      await AccountSettingsLayout({
        params: Promise.resolve({ locale: "en-US" }),
        children,
      }),
    );
  }

  it("renders children content", async () => {
    await renderLayout();
    expect(screen.getByText("Child Content")).toBeInTheDocument();
  });

  it("renders navigation with tab labels", async () => {
    await renderLayout();

    expect(screen.getByText("account:overview.title")).toBeInTheDocument();
    // "settings.title" appears in both desktop nav and mobile menu
    expect(screen.getAllByText("account:settings.title").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("account:security.title")).toBeInTheDocument();
  });

  it("marks settings tab as active via aria-selected", async () => {
    await renderLayout("/en-US/platform/account/settings");
    const settingsTab = screen.getByRole("tab", { name: "account:settings.title" });
    expect(settingsTab).toHaveAttribute("aria-selected", "true");
  });

  it("renders disabled tabs without links", async () => {
    await renderLayout();

    // "Overview" is disabled — should not be a link
    const overviewElements = screen.getAllByText("account:overview.title");
    const overviewInDesktop = overviewElements.find((el) => el.closest("a") === null);
    expect(overviewInDesktop).toBeDefined();
  });
});
