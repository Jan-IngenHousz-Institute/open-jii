import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { useMacros } from "~/hooks/macro/useMacros/useMacros";

import { ListMacros } from "./list-macros";

// Mock the hooks
vi.mock("~/hooks/macro/useMacros/useMacros");
const mockUseMacros = vi.mocked(useMacros);

// Mock the translation hook
vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key, // Return the key as the translation
  }),
}));

// Mock the MacroOverviewCards component
vi.mock("./macro-overview-cards", () => ({
  MacroOverviewCards: ({
    macros,
    isLoading,
  }: {
    macros: Record<string, unknown>[];
    isLoading: boolean;
  }) => (
    <div data-testid="macro-overview-cards">
      {isLoading ? "Loading..." : `${macros.length || 0} macros`}
    </div>
  ),
}));

// Mock UI components
vi.mock("@repo/ui/components", () => ({
  Select: ({
    value,
    onValueChange,
  }: {
    children: React.ReactNode;
    value?: string;
    onValueChange: (value: string) => void;
  }) => (
    <div>
      {!value && <span>macros.filterByLanguage</span>}
      <select
        value={value}
        onChange={(e) => onValueChange((e.target as HTMLSelectElement).value)}
        data-testid="language-select"
      >
        <option value="all">All Languages</option>
        <option value="python">Python</option>
        <option value="r">R</option>
        <option value="javascript">JavaScript</option>
      </select>
    </div>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: () => null,
  SelectItem: () => null,
  Input: ({
    placeholder,
    value,
    onChange,
    ...props
  }: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      data-testid="search-input"
      {...props}
    />
  ),
}));

describe("ListMacros", () => {
  const mockMacros = [
    {
      id: "macro-1",
      name: "Python Analysis",
      description: "A Python macro",
      language: "python" as const,
      code: "python_analysis.py",
      createdBy: "user-1",
      createdByName: "User 1",
      createdAt: "2023-01-01T00:00:00Z",
      updatedAt: "2023-01-01T00:00:00Z",
    },
    {
      id: "macro-2",
      name: "R Statistics",
      description: "An R macro",
      language: "r" as const,
      code: "r_statistics.r",
      createdBy: "user-2",
      createdByName: "User 2",
      createdAt: "2023-01-02T00:00:00Z",
      updatedAt: "2023-01-02T00:00:00Z",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseMacros.mockReturnValue({
      data: mockMacros,
      isLoading: false,
      error: null,
    });
  });

  it("should render search input and language filter", () => {
    // Act
    render(<ListMacros />);

    // Assert
    expect(screen.getByTestId("search-input")).toBeInTheDocument();
    expect(screen.getByTestId("language-select")).toBeInTheDocument();
  });

  it("should call useMacros with empty filter initially", () => {
    // Act
    render(<ListMacros />);

    // Assert
    expect(mockUseMacros).toHaveBeenCalledWith({
      search: undefined,
      language: undefined,
    });
  });

  it("should update search when typing in search input", async () => {
    // Arrange
    const user = userEvent.setup();
    render(<ListMacros />);
    const searchInput = screen.getByTestId("search-input");

    // Act
    await user.type(searchInput, "python");

    // Assert
    await waitFor(() => {
      expect(mockUseMacros).toHaveBeenCalledWith({
        search: "python",
        language: undefined,
      });
    });
  });

  it("should update language filter when selecting language", async () => {
    // Arrange
    render(<ListMacros />);
    const languageSelect = screen.getByTestId("language-select");

    // Act
    fireEvent.change(languageSelect, { target: { value: "python" } });

    // Assert - Check the last call since the hook is called initially too
    await waitFor(() => {
      expect(mockUseMacros).toHaveBeenLastCalledWith({
        search: undefined,
        language: "python",
      });
    });
  });

  it("should display error message when there is an error", () => {
    // Arrange
    mockUseMacros.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("Failed to load"),
    });

    // Act
    render(<ListMacros />);

    // Assert
    expect(screen.getByText("macros.errorLoading")).toBeInTheDocument();
  });

  it("should pass loading state to MacroOverviewCards", () => {
    // Arrange
    mockUseMacros.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    });

    // Act
    render(<ListMacros />);

    // Assert
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("should pass macro data to MacroOverviewCards", () => {
    // Act
    render(<ListMacros />);

    // Assert
    expect(screen.getByText("2 macros")).toBeInTheDocument();
  });

  it("should handle empty search gracefully", async () => {
    // Arrange
    const user = userEvent.setup();
    render(<ListMacros />);
    const searchInput = screen.getByTestId("search-input");

    // Act
    await user.type(searchInput, "test");
    await user.clear(searchInput);

    // Assert
    await waitFor(() => {
      expect(mockUseMacros).toHaveBeenCalledWith({
        search: undefined,
        language: undefined,
      });
    });
  });

  it("should handle language filter reset", () => {
    // Arrange
    render(<ListMacros />);
    const languageSelect = screen.getByTestId("language-select");

    // Act - First set a language, then reset to "all"
    fireEvent.change(languageSelect, { target: { value: "python" } });

    // Clear the mock calls to just check the last call
    mockUseMacros.mockClear();

    // Reset to "all" (which should translate to undefined in the component)
    fireEvent.change(languageSelect, { target: { value: "all" } });

    // Assert
    expect(mockUseMacros).toHaveBeenCalledWith({
      search: undefined,
      language: undefined,
    });
  });

  it("should combine search and language filters", async () => {
    // Arrange
    const user = userEvent.setup();
    render(<ListMacros />);
    const searchInput = screen.getByTestId("search-input");
    const languageSelect = screen.getByTestId("language-select");

    // Act - First set search
    await user.type(searchInput, "analysis");

    // Then set language
    fireEvent.change(languageSelect, { target: { value: "python" } });

    // Assert
    await waitFor(() => {
      expect(mockUseMacros).toHaveBeenLastCalledWith({
        search: "analysis",
        language: "python",
      });
    });
  });

  it("should render with correct placeholder texts", () => {
    // Act
    render(<ListMacros />);

    // Assert
    expect(screen.getByPlaceholderText("macros.searchPlaceholder")).toBeInTheDocument();
    // The placeholder is inside SelectValue so we don't check for direct text node
    expect(screen.getByTestId("language-select")).toBeInTheDocument();
  });

  it("should maintain filter state across re-renders", async () => {
    // Arrange
    const user = userEvent.setup();
    const { rerender } = render(<ListMacros />);
    const searchInput = screen.getByTestId("search-input");

    // Act
    await user.type(searchInput, "test");
    rerender(<ListMacros />);

    // Assert
    const inputElement = screen.getByTestId<HTMLInputElement>("search-input");
    expect(inputElement.value).toBe("test");
  });
});
