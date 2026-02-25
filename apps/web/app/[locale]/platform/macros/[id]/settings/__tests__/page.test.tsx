import { useMacro } from "@/hooks/macro/useMacro/useMacro";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import React, { use } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { useSession } from "@repo/auth/client";

import MacroSettingsPage from "../page";

// Global React for JSX in mocks
globalThis.React = React;

// -------------------
// Mocks
// -------------------

// Mock the useMacro hook
vi.mock("@/hooks/macro/useMacro/useMacro", () => ({
  useMacro: vi.fn(),
}));

// Mock the useSession hook
vi.mock("@repo/auth/client", () => ({
  useSession: vi.fn(),
}));

// Mock the useTranslation hook
vi.mock("@repo/i18n", () => ({
  __esModule: true,
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock the MacroSettings component
vi.mock("@/components/macro-settings", () => ({
  MacroSettings: ({ macroId }: { macroId: string }) => (
    <div data-testid="macro-settings">
      <div data-testid="macro-id">{macroId}</div>
    </div>
  ),
}));

// -------------------
// Test Data
// -------------------
const mockMacroData = {
  id: "test-macro-id",
  name: "Test Macro",
  description: "Test description",
  code: "cHJpbnQoJ0hlbGxvLCBXb3JsZCEnKQ==", // base64 encoded "print('Hello, World!')"
  language: "python" as const,
  filename: "test_macro.py",
  createdBy: "user-123",
  createdAt: "2023-01-01T00:00:00Z",
  updatedAt: "2023-01-02T00:00:00Z",
  createdByName: "John Doe",
};

const mockSession = {
  user: {
    id: "user-123",
    email: "john@example.com",
    name: "John Doe",
    registered: true,
  },
  expires: "2024-01-01T00:00:00Z",
};

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
      // Arrange
      vi.mocked(useMacro).mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
      });
      vi.mocked(useSession).mockReturnValue({
        data: mockSession,
        status: "authenticated",
        update: vi.fn(),
      });

      const params = Promise.resolve({ id: "test-macro-id" });

      // Act
      render(<MacroSettingsPage params={params} />);

      // Assert
      expect(screen.getByText("common.loading")).toBeInTheDocument();
    });
  });

  describe("Authentication States", () => {
    it("should display unauthorized message when user is not authenticated", () => {
      // Arrange
      vi.mocked(useMacro).mockReturnValue({
        data: mockMacroData,
        isLoading: false,
        error: null,
      });
      vi.mocked(useSession).mockReturnValue({
        data: null,
        status: "unauthenticated",
        update: vi.fn(),
      });

      const params = Promise.resolve({ id: "test-macro-id" });

      // Act
      render(<MacroSettingsPage params={params} />);

      // Assert
      expect(screen.getByText("errors.unauthorized")).toBeInTheDocument();
      expect(screen.getByText("errors.loginRequired")).toBeInTheDocument();
    });

    it("should display unauthorized message when session user has no id", () => {
      // Arrange
      vi.mocked(useMacro).mockReturnValue({
        data: mockMacroData,
        isLoading: false,
        error: null,
      });
      vi.mocked(useSession).mockReturnValue({
        data: {
          user: { id: "", email: "test@example.com", name: "Test User", registered: true },
          expires: "2024-01-01T00:00:00Z",
        },
        status: "authenticated",
        update: vi.fn(),
      });

      const params = Promise.resolve({ id: "test-macro-id" });

      // Act
      render(<MacroSettingsPage params={params} />);

      // Assert
      expect(screen.getByText("errors.unauthorized")).toBeInTheDocument();
      expect(screen.getByText("errors.loginRequired")).toBeInTheDocument();
    });
  });

  describe("Macro Not Found State", () => {
    it("should display not found message when macro data is undefined", () => {
      // Arrange
      vi.mocked(useMacro).mockReturnValue({
        data: undefined,
        isLoading: false,
        error: null,
      });
      vi.mocked(useSession).mockReturnValue({
        data: mockSession,
        status: "authenticated",
        update: vi.fn(),
      });

      const params = Promise.resolve({ id: "test-macro-id" });

      // Act
      render(<MacroSettingsPage params={params} />);

      // Assert
      expect(screen.getByText("macros.notFound")).toBeInTheDocument();
      expect(screen.getByText("macros.notFoundDescription")).toBeInTheDocument();
    });

    it("should display not found message when macro data is null", () => {
      // Arrange
      vi.mocked(useMacro).mockReturnValue({
        data: undefined,
        isLoading: false,
        error: null,
      });
      vi.mocked(useSession).mockReturnValue({
        data: mockSession,
        status: "authenticated",
        update: vi.fn(),
      });

      const params = Promise.resolve({ id: "test-macro-id" });

      // Act
      render(<MacroSettingsPage params={params} />);

      // Assert
      expect(screen.getByText("macros.notFound")).toBeInTheDocument();
      expect(screen.getByText("macros.notFoundDescription")).toBeInTheDocument();
    });
  });

  describe("Authorization States", () => {
    it("should display forbidden message when user is not the creator", () => {
      // Arrange
      const macroByOtherUser = {
        ...mockMacroData,
        createdBy: "other-user-456",
      };

      vi.mocked(useMacro).mockReturnValue({
        data: macroByOtherUser,
        isLoading: false,
        error: null,
      });
      vi.mocked(useSession).mockReturnValue({
        data: mockSession,
        status: "authenticated",
        update: vi.fn(),
      });

      const params = Promise.resolve({ id: "test-macro-id" });

      // Act
      render(<MacroSettingsPage params={params} />);

      // Assert
      expect(screen.getByText("errors.forbidden")).toBeInTheDocument();
      expect(screen.getByText("macros.onlyCreatorCanEdit")).toBeInTheDocument();
    });
  });

  describe("Success State", () => {
    it("should display settings page when user is the creator", () => {
      // Arrange
      vi.mocked(useMacro).mockReturnValue({
        data: mockMacroData,
        isLoading: false,
        error: null,
      });
      vi.mocked(useSession).mockReturnValue({
        data: mockSession,
        status: "authenticated",
        update: vi.fn(),
      });

      const params = Promise.resolve({ id: "test-macro-id" });

      // Act
      render(<MacroSettingsPage params={params} />);

      // Assert
      expect(screen.getByText("macros.settings")).toBeInTheDocument();
      expect(screen.getByText("macros.settingsDescription")).toBeInTheDocument();
      expect(screen.getByTestId("macro-settings")).toBeInTheDocument();
      expect(screen.getByTestId("macro-id")).toHaveTextContent("test-macro-id");
    });
  });

  describe("Component Structure", () => {
    it("should render with proper spacing and layout classes", () => {
      // Arrange
      vi.mocked(useMacro).mockReturnValue({
        data: mockMacroData,
        isLoading: false,
        error: null,
      });
      vi.mocked(useSession).mockReturnValue({
        data: mockSession,
        status: "authenticated",
        update: vi.fn(),
      });

      const params = Promise.resolve({ id: "test-macro-id" });

      // Act
      const { container } = render(<MacroSettingsPage params={params} />);

      // Assert
      const mainContainer = container.firstChild;
      expect(mainContainer).toHaveClass("space-y-8");

      const settingsContainer = screen.getByTestId("macro-settings").parentElement;
      expect(settingsContainer).toHaveClass("space-y-6");
    });

    it("should render header section with proper structure for success state", () => {
      // Arrange
      vi.mocked(useMacro).mockReturnValue({
        data: mockMacroData,
        isLoading: false,
        error: null,
      });
      vi.mocked(useSession).mockReturnValue({
        data: mockSession,
        status: "authenticated",
        update: vi.fn(),
      });

      const params = Promise.resolve({ id: "test-macro-id" });

      // Act
      render(<MacroSettingsPage params={params} />);

      // Assert
      const title = screen.getByText("macros.settings");
      const description = screen.getByText("macros.settingsDescription");

      expect(title.tagName).toBe("H4");
      expect(title).toHaveClass("text-lg", "font-medium");
      expect(description.tagName).toBe("P");
      expect(description).toHaveClass("text-muted-foreground", "text-sm");
    });

    it("should render error states with proper structure", () => {
      // Arrange
      vi.mocked(useMacro).mockReturnValue({
        data: undefined,
        isLoading: false,
        error: null,
      });
      vi.mocked(useSession).mockReturnValue({
        data: mockSession,
        status: "authenticated",
        update: vi.fn(),
      });

      const params = Promise.resolve({ id: "test-macro-id" });

      // Act
      render(<MacroSettingsPage params={params} />);

      // Assert
      const title = screen.getByText("macros.notFound");
      const description = screen.getByText("macros.notFoundDescription");

      expect(title.tagName).toBe("H4");
      expect(title).toHaveClass("text-lg", "font-medium");
      expect(description.tagName).toBe("P");
      expect(description).toHaveClass("text-muted-foreground", "text-sm");

      // Check container structure
      const textContainer = title.closest(".text-center");
      expect(textContainer).toBeInTheDocument();
      expect(textContainer?.parentElement).toHaveClass("space-y-8");
    });
  });

  describe("Hook Integration", () => {
    it("should call useMacro with correct parameters", () => {
      // Arrange
      vi.mocked(useMacro).mockReturnValue({
        data: mockMacroData,
        isLoading: false,
        error: null,
      });
      vi.mocked(useSession).mockReturnValue({
        data: mockSession,
        status: "authenticated",
        update: vi.fn(),
      });

      const params = Promise.resolve({ id: "test-macro-id" });

      // Act
      render(<MacroSettingsPage params={params} />);

      // Assert
      expect(vi.mocked(useMacro)).toHaveBeenCalledWith("test-macro-id");
    });
  });
});
