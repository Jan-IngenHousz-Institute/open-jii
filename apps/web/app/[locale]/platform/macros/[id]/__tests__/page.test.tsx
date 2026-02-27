import { createMacro } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, waitFor } from "@/test/test-utils";
import { use } from "react";
import { vi, describe, it, expect, beforeEach } from "vitest";

import { contract } from "@repo/api";

import MacroOverviewPage from "../page";

// Mock the date utility
vi.mock("@/util/date", () => ({
  formatDate: (dateString: string) => `formatted-${dateString}`,
}));

// Mock the ErrorDisplay component
vi.mock("@/components/error-display", () => ({
  ErrorDisplay: ({ error, title }: { error: unknown; title: string }) => (
    <div data-testid="error-display">
      <div data-testid="error-title">{title}</div>
      <div data-testid="error-message">{String(error)}</div>
    </div>
  ),
}));

// Mock the MacroCodeViewer component
vi.mock("@/components/macro-code-viewer", () => ({
  default: ({ value, language, height }: { value: string; language: string; height: string }) => (
    <div data-testid="macro-code-viewer">
      <div data-testid="code-value">{value}</div>
      <div data-testid="code-language">{language}</div>
      <div data-testid="code-height">{height}</div>
    </div>
  ),
}));

function mountMacro(overrides: Parameters<typeof createMacro>[0] = {}) {
  const macro = createMacro({ id: "test-macro-id", ...overrides });
  server.mount(contract.macros.getMacro, { body: macro });
  return macro;
}

describe("MacroOverviewPage", () => {
  const mockParams = Promise.resolve({ id: "test-macro-id" });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(use).mockReturnValue({ id: "test-macro-id" });
  });

  describe("Loading State", () => {
    it("should display loading message when data is loading", () => {
      server.mount(contract.macros.getMacro, { body: createMacro(), delay: 999_999 });

      render(<MacroOverviewPage params={mockParams} />);

      expect(screen.getByText("common.loading")).toBeInTheDocument();
    });
  });

  describe("Error State", () => {
    it("should display error component when there is an error", async () => {
      server.mount(contract.macros.getMacro, { status: 500 });

      render(<MacroOverviewPage params={mockParams} />);

      await waitFor(() => {
        expect(screen.getByTestId("error-display")).toBeInTheDocument();
        expect(screen.getByTestId("error-title")).toHaveTextContent("errors.failedToLoadMacro");
      });
    });
  });

  describe("Success State", () => {
    it("should display macro information when data is loaded", async () => {
      const macro = mountMacro();

      render(<MacroOverviewPage params={mockParams} />);

      await waitFor(() => {
        expect(screen.getByText(macro.name)).toBeInTheDocument();
      });
      expect(screen.getByText(macro.description!)).toBeInTheDocument();
      expect(screen.getByText("Python")).toBeInTheDocument();
      expect(screen.getByText(`formatted-${macro.createdAt}`)).toBeInTheDocument();
      expect(screen.getByText(`formatted-${macro.updatedAt}`)).toBeInTheDocument();
      expect(screen.getByText(macro.createdByName!)).toBeInTheDocument();
    });

    it("should display macro code viewer when code is available", async () => {
      mountMacro({ code: btoa("print('Hello, World!')") });

      render(<MacroOverviewPage params={mockParams} />);

      await waitFor(() => {
        expect(screen.getByTestId("macro-code-viewer")).toBeInTheDocument();
      });
      expect(screen.getByTestId("code-value")).toHaveTextContent("print('Hello, World!')");
      expect(screen.getByTestId("code-language")).toHaveTextContent("python");
      expect(screen.getByTestId("code-height")).toHaveTextContent("500px");
    });

    it("should handle macro without description", async () => {
      const macro = mountMacro({ description: null });

      render(<MacroOverviewPage params={mockParams} />);

      await waitFor(() => {
        expect(screen.getByText(macro.name)).toBeInTheDocument();
      });
      expect(screen.queryByText("common.description")).not.toBeInTheDocument();
    });

    it("should display description in separate card when available", async () => {
      const macro = mountMacro();

      render(<MacroOverviewPage params={mockParams} />);

      await waitFor(() => {
        expect(screen.getByText("common.description")).toBeInTheDocument();
      });
      expect(screen.getByText(macro.description!)).toBeInTheDocument();
    });

    it("should handle macro without createdByName", async () => {
      mountMacro({ createdByName: undefined });

      render(<MacroOverviewPage params={mockParams} />);

      await waitFor(() => {
        expect(screen.getByText("-")).toBeInTheDocument();
      });
    });

    it("should handle macro without code", async () => {
      mountMacro({ code: "" });

      render(<MacroOverviewPage params={mockParams} />);

      await waitFor(() => {
        expect(screen.getByText("macros.codeNotAvailable")).toBeInTheDocument();
      });
      expect(screen.getByText("macros.codeWillBeDisplayedWhenApiImplemented")).toBeInTheDocument();
      expect(screen.queryByTestId("macro-code-viewer")).not.toBeInTheDocument();
    });

    it("should handle invalid base64 code gracefully", async () => {
      mountMacro({ code: "invalid-base64!" });

      render(<MacroOverviewPage params={mockParams} />);

      await waitFor(() => {
        expect(screen.getByTestId("macro-code-viewer")).toBeInTheDocument();
      });
      expect(screen.getByTestId("code-value")).toHaveTextContent("Error decoding content");
    });
  });

  describe("Language Display and Colors", () => {
    it.each([
      ["python", "Python", "bg-badge-published"],
      ["r", "R", "bg-badge-stale"],
      ["javascript", "JavaScript", "bg-badge-provisioningFailed"],
      ["unknown", "unknown", "bg-badge-archived"],
    ])(
      "should display correct language and color for %s",
      async (language, displayName, colorClass) => {
        mountMacro({ language: language as "python" | "r" | "javascript" });

        render(<MacroOverviewPage params={mockParams} />);

        await waitFor(() => {
          const badges = screen.getAllByText(displayName);
          const badge = badges.find((el) => el.classList.contains(colorClass));
          expect(badge).toBeTruthy();
        });
      },
    );
  });

  describe("Component Structure", () => {
    it("should render all content sections", async () => {
      const macro = mountMacro();

      render(<MacroOverviewPage params={mockParams} />);

      await waitFor(() => {
        // Info section
        expect(screen.getByText(macro.name)).toBeInTheDocument();
        expect(screen.getByText("common.created")).toBeInTheDocument();
        expect(screen.getByText("common.updated")).toBeInTheDocument();
        expect(screen.getByText("common.createdBy")).toBeInTheDocument();
        // Description section
        expect(screen.getByText("common.description")).toBeInTheDocument();
        // Code section
        expect(screen.getByText("macros.code")).toBeInTheDocument();
      });
    });
  });
});
