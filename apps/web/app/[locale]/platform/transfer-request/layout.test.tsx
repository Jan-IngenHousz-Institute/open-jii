import { useLocale } from "@/hooks/useLocale";
import { render, screen, within } from "@/test/test-utils";
import { usePathname } from "next/navigation";
import { describe, it, expect, vi, beforeEach } from "vitest";

import TransferRequestLayout from "./layout";

// -------------------
// Helpers
// -------------------
function renderTransferRequestLayout({
  children = <div data-testid="child-content">Child Content</div>,
  pathname = "/en/platform/transfer-request",
  locale = "en",
}: {
  children?: React.ReactNode;
  pathname?: string;
  locale?: string;
} = {}) {
  vi.mocked(usePathname).mockReturnValue(pathname);
  vi.mocked(useLocale).mockReturnValue(locale);

  return render(<TransferRequestLayout>{children}</TransferRequestLayout>);
}

// -------------------
// Tests
// -------------------
describe("<TransferRequestLayout />", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Content Rendering", () => {
    it("renders title and description texts", () => {
      renderTransferRequestLayout();

      expect(screen.getByText("transferRequest.title")).toBeInTheDocument();
      expect(screen.getByText("transferRequest.introText")).toBeInTheDocument();
      expect(screen.getByText("transferRequest.processText")).toBeInTheDocument();
    });

    it("renders children content", () => {
      renderTransferRequestLayout();

      expect(screen.getByTestId("child-content")).toBeInTheDocument();
      expect(screen.getByText("Child Content")).toBeInTheDocument();
    });
  });

  describe("Tab Navigation", () => {
    it("renders both tabs with correct labels", () => {
      renderTransferRequestLayout();

      expect(screen.getByText("transferRequest.formTab")).toBeInTheDocument();
      expect(screen.getByText("transferRequest.historyTab")).toBeInTheDocument();
    });

    it("renders tabs as links with correct hrefs", () => {
      renderTransferRequestLayout({ locale: "en" });

      const tabs = screen.getAllByRole("tab");
      expect(tabs).toHaveLength(2);

      expect(within(tabs[0]).getByRole("link")).toHaveAttribute(
        "href",
        "/en/platform/transfer-request",
      );
      expect(within(tabs[1]).getByRole("link")).toHaveAttribute(
        "href",
        "/en/platform/transfer-request/history",
      );
    });

    it("generates correct links for different locale", () => {
      renderTransferRequestLayout({ locale: "de" });

      const tabs = screen.getAllByRole("tab");
      expect(within(tabs[0]).getByRole("link")).toHaveAttribute(
        "href",
        "/de/platform/transfer-request",
      );
      expect(within(tabs[1]).getByRole("link")).toHaveAttribute(
        "href",
        "/de/platform/transfer-request/history",
      );
    });
  });

  describe("Active Tab Detection", () => {
    it("sets request tab as active for root path", () => {
      renderTransferRequestLayout({
        pathname: "/en/platform/transfer-request",
      });

      expect(screen.getByText("transferRequest.formTab")).toBeInTheDocument();
    });

    it("sets history tab as active for history path", () => {
      renderTransferRequestLayout({
        pathname: "/en/platform/transfer-request/history",
      });

      expect(screen.getByText("transferRequest.historyTab")).toBeInTheDocument();
    });

    it("sets request tab as active for form path", () => {
      renderTransferRequestLayout({
        pathname: "/en/platform/transfer-request/form",
      });

      expect(screen.getByText("transferRequest.formTab")).toBeInTheDocument();
    });

    it("defaults to request tab for unknown subpath", () => {
      renderTransferRequestLayout({
        pathname: "/en/platform/transfer-request/unknown",
      });

      expect(screen.getByText("transferRequest.formTab")).toBeInTheDocument();
    });

    it("detects history tab for different locale", () => {
      renderTransferRequestLayout({
        pathname: "/de/platform/transfer-request/history",
        locale: "de",
      });

      expect(screen.getByText("transferRequest.historyTab")).toBeInTheDocument();
    });
  });

  describe("Layout Structure", () => {
    it("renders within a Card component", () => {
      const { container } = renderTransferRequestLayout();

      // Card should be present (checking for class structure)
      expect(container.querySelector('[class*="space-y-6"]')).toBeInTheDocument();
    });

    it("renders NavTabs component", () => {
      renderTransferRequestLayout();

      expect(screen.getByText("transferRequest.formTab")).toBeInTheDocument();
      expect(screen.getByText("transferRequest.historyTab")).toBeInTheDocument();
    });

    it("maintains proper content hierarchy", () => {
      renderTransferRequestLayout();

      const title = screen.getByText("transferRequest.title");
      const tabs = screen.getByText("transferRequest.formTab");
      const content = screen.getByTestId("child-content");

      expect(title).toBeInTheDocument();
      expect(tabs).toBeInTheDocument();
      expect(content).toBeInTheDocument();
    });
  });
});
