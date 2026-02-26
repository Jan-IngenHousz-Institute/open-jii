import { createMacro } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, waitFor } from "@/test/test-utils";
import { use } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { contract } from "@repo/api";
import { useSession } from "@repo/auth/client";

import MacroSettingsPage from "../page";

// Mock the MacroSettings component
vi.mock("@/components/macro-settings", () => ({
  MacroSettings: ({ macroId }: { macroId: string }) => (
    <div data-testid="macro-settings">
      <div data-testid="macro-id">{macroId}</div>
    </div>
  ),
}));

function mountMacro(overrides: Parameters<typeof createMacro>[0] = {}) {
  const macro = createMacro({ id: "test-macro-id", createdBy: "user-123", ...overrides });
  server.mount(contract.macros.getMacro, { body: macro });
  return macro;
}

function mockAuthenticated(userId = "user-123") {
  vi.mocked(useSession).mockReturnValue({
    data: {
      user: {
        id: userId,
        email: "john@example.com",
        name: "John Doe",
        registered: true,
      },
      expires: "2024-01-01T00:00:00Z",
    },
    status: "authenticated",
    update: vi.fn(),
  } as never);
}

function mockUnauthenticated() {
  vi.mocked(useSession).mockReturnValue({
    data: null,
    status: "unauthenticated",
    update: vi.fn(),
  } as never);
}

// -------------------
// Tests
// -------------------
describe("<MacroSettingsPage />", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(use).mockReturnValue({ id: "test-macro-id" });
  });

  describe("Loading State", () => {
    it("should display loading message when data is loading", () => {
      server.mount(contract.macros.getMacro, { body: createMacro(), delay: 999_999 });
      mockAuthenticated();

      render(<MacroSettingsPage params={Promise.resolve({ id: "test-macro-id" })} />);

      expect(screen.getByText("common.loading")).toBeInTheDocument();
    });
  });

  describe("Authentication States", () => {
    it("should display unauthorized message when user is not authenticated", async () => {
      mountMacro();
      mockUnauthenticated();

      render(<MacroSettingsPage params={Promise.resolve({ id: "test-macro-id" })} />);

      await waitFor(() => {
        expect(screen.getByText("errors.unauthorized")).toBeInTheDocument();
        expect(screen.getByText("errors.loginRequired")).toBeInTheDocument();
      });
    });

    it("should display unauthorized message when session user has no id", async () => {
      mountMacro();
      vi.mocked(useSession).mockReturnValue({
        data: {
          user: { id: "", email: "test@example.com", name: "Test User", registered: true },
          expires: "2024-01-01T00:00:00Z",
        },
        status: "authenticated",
        update: vi.fn(),
      } as never);

      render(<MacroSettingsPage params={Promise.resolve({ id: "test-macro-id" })} />);

      await waitFor(() => {
        expect(screen.getByText("errors.unauthorized")).toBeInTheDocument();
        expect(screen.getByText("errors.loginRequired")).toBeInTheDocument();
      });
    });
  });

  describe("Macro Not Found State", () => {
    it("should display not found message when API returns 404", async () => {
      server.mount(contract.macros.getMacro, { status: 404 });
      mockAuthenticated();

      render(<MacroSettingsPage params={Promise.resolve({ id: "test-macro-id" })} />);

      await waitFor(() => {
        expect(screen.getByText("macros.notFound")).toBeInTheDocument();
        expect(screen.getByText("macros.notFoundDescription")).toBeInTheDocument();
      });
    });
  });

  describe("Authorization States", () => {
    it("should display forbidden message when user is not the creator", async () => {
      mountMacro({ createdBy: "other-user-456" });
      mockAuthenticated();

      render(<MacroSettingsPage params={Promise.resolve({ id: "test-macro-id" })} />);

      await waitFor(() => {
        expect(screen.getByText("errors.forbidden")).toBeInTheDocument();
        expect(screen.getByText("macros.onlyCreatorCanEdit")).toBeInTheDocument();
      });
    });
  });

  describe("Success State", () => {
    it("should display settings page when user is the creator", async () => {
      mountMacro();
      mockAuthenticated();

      render(<MacroSettingsPage params={Promise.resolve({ id: "test-macro-id" })} />);

      await waitFor(() => {
        expect(screen.getByText("macros.settings")).toBeInTheDocument();
      });
      expect(screen.getByText("macros.settingsDescription")).toBeInTheDocument();
      expect(screen.getByTestId("macro-settings")).toBeInTheDocument();
      expect(screen.getByTestId("macro-id")).toHaveTextContent("test-macro-id");
    });
  });

  describe("Component Structure", () => {
    it("should render with proper spacing and layout classes", async () => {
      mountMacro();
      mockAuthenticated();

      const { container } = render(
        <MacroSettingsPage params={Promise.resolve({ id: "test-macro-id" })} />,
      );

      await waitFor(() => {
        expect(screen.getByTestId("macro-settings")).toBeInTheDocument();
      });

      const mainContainer = container.firstChild;
      expect(mainContainer).toHaveClass("space-y-8");

      const settingsContainer = screen.getByTestId("macro-settings").parentElement;
      expect(settingsContainer).toHaveClass("space-y-6");
    });

    it("should render header section with proper structure for success state", async () => {
      mountMacro();
      mockAuthenticated();

      render(<MacroSettingsPage params={Promise.resolve({ id: "test-macro-id" })} />);

      await waitFor(() => {
        const title = screen.getByText("macros.settings");
        expect(title.tagName).toBe("H4");
        expect(title).toHaveClass("text-lg", "font-medium");
      });

      const description = screen.getByText("macros.settingsDescription");
      expect(description.tagName).toBe("P");
      expect(description).toHaveClass("text-muted-foreground", "text-sm");
    });

    it("should render error states with proper structure", async () => {
      server.mount(contract.macros.getMacro, { status: 404 });
      mockAuthenticated();

      render(<MacroSettingsPage params={Promise.resolve({ id: "test-macro-id" })} />);

      await waitFor(() => {
        const title = screen.getByText("macros.notFound");
        expect(title.tagName).toBe("H4");
        expect(title).toHaveClass("text-lg", "font-medium");
      });

      const description = screen.getByText("macros.notFoundDescription");
      expect(description.tagName).toBe("P");
      expect(description).toHaveClass("text-muted-foreground", "text-sm");
    });
  });

  describe("Hook Integration", () => {
    it("should call useMacro with correct parameters", async () => {
      mountMacro();
      mockAuthenticated();

      render(<MacroSettingsPage params={Promise.resolve({ id: "test-macro-id" })} />);

      await waitFor(() => {
        expect(screen.getByTestId("macro-settings")).toBeInTheDocument();
      });
    });
  });
});
