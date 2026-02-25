import { useMacro } from "@/hooks/macro/useMacro/useMacro";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import React, { use } from "react";
import { vi, describe, it, expect, beforeEach } from "vitest";

import MacroOverviewPage from "../page";

// Mock the useMacro hook
vi.mock("@/hooks/macro/useMacro/useMacro", () => ({
  useMacro: vi.fn(),
}));

// Mock the date utility
vi.mock("@/util/date", () => ({
  formatDate: (dateString: string) => `formatted-${dateString}`,
}));

// Mock the i18n hook
vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
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

// Mock Lucide icons
vi.mock("lucide-react", () => ({
  CalendarIcon: () => <div data-testid="calendar-icon" />,
  CodeIcon: () => <div data-testid="code-icon" />,
  UserIcon: () => <div data-testid="user-icon" />,
}));

// Mock UI components
vi.mock("@repo/ui/components", () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div data-testid="card">{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="card-header">{children}</div>
  ),
  CardTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-title" className={className}>
      {children}
    </div>
  ),
  CardContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="card-content">{children}</div>
  ),
  Badge: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="badge" className={className}>
      {children}
    </div>
  ),
  RichTextRenderer: ({ content }: { content: string }) => (
    <div data-testid="rich-text-renderer">{content}</div>
  ),
}));

const mockUseMacro = vi.mocked(useMacro);

// Mock data that can be reused across tests
const mockMacroData = {
  id: "test-macro-id",
  name: "Test Macro",
  filename: "test_macro.py",
  description: "This is a test macro description",
  language: "python" as const,
  code: btoa("print('Hello, World!')"), // base64 encoded
  createdBy: "creator-id",
  createdAt: "2023-01-01T00:00:00Z",
  updatedAt: "2023-01-02T00:00:00Z",
  createdByName: "John Doe",
  sortOrder: null,
};

describe("MacroOverviewPage", () => {
  const mockParams = Promise.resolve({ id: "test-macro-id" });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(use).mockReturnValue({ id: "test-macro-id" });
  });

  describe("Loading State", () => {
    it("should display loading message when data is loading", () => {
      // Arrange
      const mockUseMacro = vi.fn().mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
      });
      vi.mocked(useMacro).mockImplementation(mockUseMacro);

      const params = Promise.resolve({ id: "test-macro-id" });

      // Act
      render(<MacroOverviewPage params={params} />);

      // Assert
      expect(screen.getByText("common.loading")).toBeInTheDocument();
      expect(mockUseMacro).toHaveBeenCalledWith("test-macro-id");
    });
  });

  describe("Error State", () => {
    it("should display error component when there is an error", () => {
      // Arrange
      const mockError = new Error("Failed to fetch macro");
      mockUseMacro.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: mockError,
      });

      // Act
      render(<MacroOverviewPage params={mockParams} />);

      // Assert
      expect(screen.getByTestId("error-display")).toBeInTheDocument();
      expect(screen.getByTestId("error-title")).toHaveTextContent("errors.failedToLoadMacro");
      expect(mockUseMacro).toHaveBeenCalledWith("test-macro-id");
    });
  });

  describe("Not Found State", () => {
    it("should display not found message when data is undefined", () => {
      // Arrange
      mockUseMacro.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: null,
      });

      // Act
      render(<MacroOverviewPage params={mockParams} />);

      // Assert
      expect(screen.getByText("macros.notFound")).toBeInTheDocument();
    });
  });

  describe("Success State", () => {
    it("should display macro information when data is loaded", () => {
      // Arrange
      mockUseMacro.mockReturnValue({
        data: mockMacroData,
        isLoading: false,
        error: null,
      });

      // Act
      render(<MacroOverviewPage params={mockParams} />);

      // Assert
      expect(screen.getByText("Test Macro")).toBeInTheDocument();
      expect(screen.getByTestId("rich-text-renderer")).toHaveTextContent(
        "This is a test macro description",
      );
      expect(screen.getByText("Python")).toBeInTheDocument();
      expect(screen.getByText("formatted-2023-01-01T00:00:00Z")).toBeInTheDocument();
      expect(screen.getByText("formatted-2023-01-02T00:00:00Z")).toBeInTheDocument();
      expect(screen.getByText("John Doe")).toBeInTheDocument();
    });

    it("should display macro code viewer when code is available", () => {
      // Arrange
      mockUseMacro.mockReturnValue({
        data: mockMacroData,
        isLoading: false,
        error: null,
      });

      // Act
      render(<MacroOverviewPage params={mockParams} />);

      // Assert
      expect(screen.getByTestId("macro-code-viewer")).toBeInTheDocument();
      expect(screen.getByTestId("code-value")).toHaveTextContent("print('Hello, World!')");
      expect(screen.getByTestId("code-language")).toHaveTextContent("python");
      expect(screen.getByTestId("code-height")).toHaveTextContent("500px");
    });

    it("should handle macro without description", () => {
      // Arrange
      const macroWithoutDescription = { ...mockMacroData, description: null };
      mockUseMacro.mockReturnValue({
        data: macroWithoutDescription,
        isLoading: false,
        error: null,
      });

      // Act
      render(<MacroOverviewPage params={mockParams} />);

      // Assert
      expect(screen.getByText("Test Macro")).toBeInTheDocument();
      // Description card should not be rendered when description is null
      expect(screen.queryByText("common.description")).not.toBeInTheDocument();
    });

    it("should display description in separate card when available", () => {
      // Arrange
      mockUseMacro.mockReturnValue({
        data: mockMacroData,
        isLoading: false,
        error: null,
      });

      // Act
      render(<MacroOverviewPage params={mockParams} />);

      // Assert
      expect(screen.getByText("common.description")).toBeInTheDocument();
      expect(screen.getByTestId("rich-text-renderer")).toBeInTheDocument();
      expect(screen.getByTestId("rich-text-renderer")).toHaveTextContent(
        "This is a test macro description",
      );
    });

    it("should handle macro without createdByName", () => {
      // Arrange
      const macroWithoutCreator = { ...mockMacroData, createdByName: undefined };
      mockUseMacro.mockReturnValue({
        data: macroWithoutCreator,
        isLoading: false,
        error: null,
      });

      // Act
      render(<MacroOverviewPage params={mockParams} />);

      // Assert
      expect(screen.getByText("-")).toBeInTheDocument();
    });

    it("should handle macro without code", () => {
      // Arrange
      const macroWithoutCode = { ...mockMacroData, code: "" };
      mockUseMacro.mockReturnValue({
        data: macroWithoutCode,
        isLoading: false,
        error: null,
      });

      // Act
      render(<MacroOverviewPage params={mockParams} />);

      // Assert
      expect(screen.getByText("macros.codeNotAvailable")).toBeInTheDocument();
      expect(screen.getByText("macros.codeWillBeDisplayedWhenApiImplemented")).toBeInTheDocument();
      expect(screen.queryByTestId("macro-code-viewer")).not.toBeInTheDocument();
    });

    it("should handle invalid base64 code gracefully", () => {
      // Arrange
      const macroWithInvalidCode = { ...mockMacroData, code: "invalid-base64!" };
      mockUseMacro.mockReturnValue({
        data: macroWithInvalidCode,
        isLoading: false,
        error: null,
      });

      // Act
      render(<MacroOverviewPage params={mockParams} />);

      // Assert
      expect(screen.getByTestId("macro-code-viewer")).toBeInTheDocument();
      expect(screen.getByTestId("code-value")).toHaveTextContent("Error decoding content");
    });
  });

  describe("Language Display and Colors", () => {
    it.each([
      ["python", "Python", "bg-badge-published"],
      ["r", "R", "bg-badge-stale"],
      ["javascript", "JavaScript", "bg-badge-provisioningFailed"],
      ["unknown", "unknown", "bg-badge-archived"],
    ])("should display correct language and color for %s", (language, displayName, colorClass) => {
      // Arrange
      const macroWithLanguage = {
        ...mockMacroData,
        language: language as "python" | "r" | "javascript",
      };

      mockUseMacro.mockReturnValue({
        data: macroWithLanguage,
        isLoading: false,
        error: null,
      });

      // Act
      render(<MacroOverviewPage params={mockParams} />);

      // Assert
      const badge = screen.getByTestId("badge");
      expect(badge).toHaveTextContent(displayName);
      expect(badge).toHaveClass(colorClass);
    });
  });

  describe("Component Structure", () => {
    it("should render proper card structure", () => {
      // Arrange
      mockUseMacro.mockReturnValue({
        data: mockMacroData,
        isLoading: false,
        error: null,
      });

      // Act
      render(<MacroOverviewPage params={mockParams} />);

      // Assert
      const cards = screen.getAllByTestId("card");
      expect(cards).toHaveLength(3); // Info card, description card, and code card

      const cardHeaders = screen.getAllByTestId("card-header");
      expect(cardHeaders).toHaveLength(3);

      const cardContents = screen.getAllByTestId("card-content");
      expect(cardContents).toHaveLength(3);

      // Check for specific icons
      expect(screen.getAllByTestId("calendar-icon")).toHaveLength(2); // Created and updated dates
      expect(screen.getByTestId("user-icon")).toBeInTheDocument();
      expect(screen.getByTestId("code-icon")).toBeInTheDocument();
    });
  });
});
