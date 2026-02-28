import { useLocale } from "@/hooks/useLocale";
import { createMacro } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, waitFor, within } from "@/test/test-utils";
import { notFound, usePathname, useParams } from "next/navigation";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { contract } from "@repo/api";

import MacroLayout from "../layout";

function mountMacro(overrides: Parameters<typeof createMacro>[0] = {}) {
  const macro = createMacro({ id: "test-macro-id", ...overrides });
  server.mount(contract.macros.getMacro, { body: macro });
  return macro;
}

function renderLayout({
  locale = "en-US",
  pathname = "/en-US/platform/macros/test-macro-id",
  macroId = "test-macro-id",
  children = <div>Child Content</div>,
}: {
  locale?: string;
  pathname?: string;
  macroId?: string;
  children?: React.ReactNode;
} = {}) {
  vi.mocked(usePathname).mockReturnValue(pathname);
  vi.mocked(useParams).mockReturnValue({ id: macroId });
  vi.mocked(useLocale).mockReturnValue(locale);

  return render(<MacroLayout>{children}</MacroLayout>);
}

describe("<MacroLayout />", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Header Content", () => {
    it("renders macro title and description", async () => {
      mountMacro();
      renderLayout();

      await waitFor(() => {
        expect(screen.getByText("macros.macro")).toBeInTheDocument();
      });
      expect(screen.getByText("macros.manageMacroDescription")).toBeInTheDocument();
    });
  });

  describe("Tab Navigation", () => {
    it("renders tabs with correct labels", async () => {
      mountMacro();
      renderLayout();

      await waitFor(() => {
        expect(screen.getByRole("tablist")).toBeInTheDocument();
      });
      const tablist = screen.getByRole("tablist");
      expect(within(tablist).getByRole("tab", { name: /macros\.overview/i })).toBeInTheDocument();
      expect(
        within(tablist).getByRole("tab", { name: /navigation\.settings/i }),
      ).toBeInTheDocument();
    });

    it("renders overview tab as active when on overview page", async () => {
      mountMacro();
      renderLayout({ pathname: "/en-US/platform/macros/test-macro-id" });

      await waitFor(() => {
        expect(screen.getByRole("tab", { name: /macros\.overview/i })).toHaveAttribute(
          "data-state",
          "active",
        );
      });
      expect(screen.getByRole("tab", { name: /navigation\.settings/i })).toHaveAttribute(
        "data-state",
        "inactive",
      );
    });

    it("renders settings tab as active when on settings page", async () => {
      mountMacro();
      renderLayout({ pathname: "/en-US/platform/macros/test-macro-id/settings" });

      await waitFor(() => {
        expect(screen.getByRole("tab", { name: /navigation\.settings/i })).toHaveAttribute(
          "data-state",
          "active",
        );
      });
      expect(screen.getByRole("tab", { name: /macros\.overview/i })).toHaveAttribute(
        "data-state",
        "inactive",
      );
    });

    it("defaults to overview tab for unknown paths", async () => {
      mountMacro();
      renderLayout({ pathname: "/en-US/platform/macros/test-macro-id/unknown" });

      await waitFor(() => {
        expect(screen.getByRole("tab", { name: /macros\.overview/i })).toHaveAttribute(
          "data-state",
          "active",
        );
      });
    });
  });

  describe("Tab Links", () => {
    it("renders overview tab with correct href", async () => {
      mountMacro();
      renderLayout({ macroId: "test-macro-id" });

      await waitFor(() => {
        expect(screen.getByRole("tab", { name: /macros\.overview/i })).toBeInTheDocument();
      });
      expect(screen.getByRole("tab", { name: /macros\.overview/i })).toHaveAttribute(
        "href",
        "/platform/macros/test-macro-id",
      );
    });

    it("renders settings tab with correct href", async () => {
      mountMacro();
      renderLayout({ macroId: "test-macro-id" });

      await waitFor(() => {
        expect(screen.getByRole("tab", { name: /navigation\.settings/i })).toBeInTheDocument();
      });
      expect(screen.getByRole("tab", { name: /navigation\.settings/i })).toHaveAttribute(
        "href",
        "/platform/macros/test-macro-id/settings",
      );
    });

    it("handles different macro id in links", async () => {
      server.mount(contract.macros.getMacro, {
        body: createMacro({ id: "another-macro-id" }),
      });
      renderLayout({ macroId: "another-macro-id" });

      await waitFor(() => {
        expect(screen.getByRole("tab", { name: /macros\.overview/i })).toBeInTheDocument();
      });
      expect(screen.getByRole("tab", { name: /macros\.overview/i })).toHaveAttribute(
        "href",
        "/platform/macros/another-macro-id",
      );
      expect(screen.getByRole("tab", { name: /navigation\.settings/i })).toHaveAttribute(
        "href",
        "/platform/macros/another-macro-id/settings",
      );
    });
  });

  describe("Content Rendering", () => {
    it("renders children content", async () => {
      mountMacro();
      renderLayout({ children: <div>Test Content</div> });

      await waitFor(() => {
        expect(screen.getByText("Test Content")).toBeInTheDocument();
      });
    });

    it("renders children within correct container", async () => {
      mountMacro();
      renderLayout({ children: <div data-testid="child-content">Child Content</div> });

      await waitFor(() => {
        expect(screen.getByTestId("child-content")).toBeInTheDocument();
      });
      const container = screen.getByTestId("child-content").parentElement;
      expect(container).toHaveClass("mx-4", "mt-6");
    });
  });

  describe("Responsive Layout", () => {
    it("renders tabs with grid layout for mobile responsiveness", async () => {
      mountMacro();
      renderLayout();

      await waitFor(() => {
        expect(screen.getByRole("tablist")).toBeInTheDocument();
      });
      expect(screen.getByRole("tablist")).toHaveClass("grid", "w-full", "grid-cols-2");
    });

    it("renders tabs container with full width", async () => {
      mountMacro();
      renderLayout();

      await waitFor(() => {
        expect(screen.getByRole("tablist")).toBeInTheDocument();
      });
      const tabsRoot = screen.getByRole("tablist").closest("[data-orientation]");
      expect(tabsRoot).toHaveClass("w-full");
    });
  });

  describe("Component Structure", () => {
    it("renders with proper spacing and layout classes", async () => {
      mountMacro();
      const { container } = renderLayout();

      await waitFor(() => {
        expect(screen.getByText("macros.macro")).toBeInTheDocument();
      });
      expect(container.firstChild).toHaveClass("space-y-6");
    });

    it("renders header section with proper structure", async () => {
      mountMacro();
      renderLayout();

      await waitFor(() => {
        expect(screen.getByText("macros.macro")).toBeInTheDocument();
      });
      const title = screen.getByText("macros.macro");
      const description = screen.getByText("macros.manageMacroDescription");

      expect(title.tagName).toBe("H3");
      expect(title).toHaveClass("text-lg", "font-medium");
      expect(description.tagName).toBe("P");
      expect(description).toHaveClass("text-muted-foreground", "text-sm");
    });
  });

  describe("Active Tab Logic", () => {
    it.each([
      { pathname: "/platform/macros/123", expected: "overview" },
      { pathname: "/en-US/platform/macros/456", expected: "overview" },
      { pathname: "/platform/macros/789/settings", expected: "settings" },
      { pathname: "/en-US/platform/macros/abc/settings", expected: "settings" },
      { pathname: "/platform/macros/def/other", expected: "overview" },
    ])("determines active tab correctly for pathname $pathname", async ({ pathname, expected }) => {
      mountMacro();
      renderLayout({ pathname });

      const expectedTab = expected === "overview" ? /macros\.overview/i : /navigation\.settings/i;
      await waitFor(() => {
        expect(screen.getByRole("tab", { name: expectedTab })).toHaveAttribute(
          "data-state",
          "active",
        );
      });
    });
  });

  describe("Loading State", () => {
    it("renders loading state when data is loading", () => {
      server.mount(contract.macros.getMacro, { body: createMacro(), delay: 999_999 });
      renderLayout();

      expect(screen.getByText("common.loading")).toBeInTheDocument();
      expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
      expect(screen.queryByText("Child Content")).not.toBeInTheDocument();
    });
  });

  describe("Error Handling", () => {
    it("calls notFound for 404 errors", async () => {
      server.mount(contract.macros.getMacro, { status: 404 });
      renderLayout();

      await waitFor(() => {
        expect(vi.mocked(notFound)).toHaveBeenCalled();
      });
    });

    it("calls notFound for 400 errors (invalid UUID)", async () => {
      server.mount(contract.macros.getMacro, { status: 400 });
      renderLayout();

      await waitFor(() => {
        expect(vi.mocked(notFound)).toHaveBeenCalled();
      });
    });

    it("renders error display for 500 server errors", async () => {
      server.mount(contract.macros.getMacro, { status: 500 });
      renderLayout();

      await waitFor(() => {
        expect(screen.getByText("errors.error")).toBeInTheDocument();
      });
      expect(screen.getByText("errors.resourceNotFoundMessage")).toBeInTheDocument();
      expect(vi.mocked(notFound)).not.toHaveBeenCalled();
    });

    it("renders error display for 403 forbidden errors", async () => {
      server.mount(contract.macros.getMacro, { status: 403 });
      renderLayout();

      await waitFor(() => {
        expect(screen.getByText("errors.error")).toBeInTheDocument();
      });
      expect(vi.mocked(notFound)).not.toHaveBeenCalled();
    });

    it("renders error display for other error statuses", async () => {
      server.mount(contract.macros.getMacro, { status: 502 });
      renderLayout();

      await waitFor(() => {
        expect(screen.getByText("errors.error")).toBeInTheDocument();
      });
      expect(vi.mocked(notFound)).not.toHaveBeenCalled();
    });
  });
});
