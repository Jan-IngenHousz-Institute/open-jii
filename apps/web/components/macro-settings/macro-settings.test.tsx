import { render, screen } from "@testing-library/react";
import React from "react";
import { vi, describe, it, expect, beforeEach } from "vitest";

// Import after mocking
import { MacroSettings } from "./macro-settings";

// Create the mock before importing any other modules
const mockUseMacro = vi.fn();

// Mock the useMacro hook
vi.mock("../../hooks/macro/useMacro/useMacro", () => ({
  useMacro: (...args: [string]) => {
    mockUseMacro(...args);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return mockUseMacro();
  },
}));

// Mock i18n
vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock child components
interface MockMacroDetailsCardProps {
  macroId: string;
  initialName: string;
  initialDescription: string;
  initialLanguage: string;
  initialCode: string;
}

interface MockMacroInfoCardProps {
  macroId: string;
  macro: { name: string };
}

vi.mock("./macro-details-card", () => ({
  MacroDetailsCard: ({
    macroId,
    initialName,
    initialDescription,
    initialLanguage,
    initialCode,
  }: MockMacroDetailsCardProps) => (
    <div data-testid="macro-details-card">
      <div data-testid="macro-id">{macroId}</div>
      <div data-testid="initial-name">{initialName}</div>
      <div data-testid="initial-description">{initialDescription}</div>
      <div data-testid="initial-language">{initialLanguage}</div>
      <div data-testid="initial-code">{initialCode}</div>
    </div>
  ),
}));

vi.mock("./macro-info-card", () => ({
  MacroInfoCard: ({ macroId, macro }: MockMacroInfoCardProps) => (
    <div data-testid="macro-info-card">
      <div data-testid="info-macro-id">{macroId}</div>
      <div data-testid="info-macro-name">{macro.name}</div>
    </div>
  ),
}));

describe("MacroSettings", () => {
  const mockMacro = {
    id: "macro-123",
    name: "Test Macro",
    description: "Test Description",
    language: "python" as const,
    code: btoa("print('Hello, World!')"), // base64 encoded code
    createdAt: "2023-01-01T00:00:00Z",
    updatedAt: "2023-01-02T00:00:00Z",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render loading state when data is loading", () => {
    mockUseMacro.mockReturnValue({
      data: null,
      isLoading: true,
    });

    render(<MacroSettings macroId="macro-123" />);

    expect(screen.getByText("macroSettings.loading")).toBeInTheDocument();
  });

  it("should render not found state when no data and not loading", () => {
    mockUseMacro.mockReturnValue({
      data: null,
      isLoading: false,
    });

    render(<MacroSettings macroId="macro-123" />);

    expect(screen.getByText("macroSettings.notFound")).toBeInTheDocument();
  });

  it("should render macro details and info cards when data is available", () => {
    mockUseMacro.mockReturnValue({
      data: mockMacro,
      isLoading: false,
    });

    render(<MacroSettings macroId="macro-123" />);

    expect(screen.getByTestId("macro-details-card")).toBeInTheDocument();
    expect(screen.getByTestId("macro-info-card")).toBeInTheDocument();
  });

  it("should pass correct props to MacroDetailsCard", () => {
    mockUseMacro.mockReturnValue({
      data: mockMacro,
      isLoading: false,
    });

    render(<MacroSettings macroId="macro-123" />);

    expect(screen.getByTestId("macro-id")).toHaveTextContent("macro-123");
    expect(screen.getByTestId("initial-name")).toHaveTextContent("Test Macro");
    expect(screen.getByTestId("initial-description")).toHaveTextContent("Test Description");
    expect(screen.getByTestId("initial-language")).toHaveTextContent("python");
  });

  it("should pass correct props to MacroInfoCard", () => {
    mockUseMacro.mockReturnValue({
      data: mockMacro,
      isLoading: false,
    });

    render(<MacroSettings macroId="macro-123" />);

    expect(screen.getByTestId("info-macro-id")).toHaveTextContent("macro-123");
    expect(screen.getByTestId("info-macro-name")).toHaveTextContent("Test Macro");
  });

  it("should handle empty description", () => {
    const macroWithoutDescription = {
      ...mockMacro,
      description: null,
    };

    mockUseMacro.mockReturnValue({
      data: macroWithoutDescription,
      isLoading: false,
    });

    render(<MacroSettings macroId="macro-123" />);

    expect(screen.getByTestId("initial-description")).toHaveTextContent("");
  });

  it("should handle undefined description", () => {
    const macroWithUndefinedDescription = {
      ...mockMacro,
      description: undefined,
    };

    mockUseMacro.mockReturnValue({
      data: macroWithUndefinedDescription,
      isLoading: false,
    });

    render(<MacroSettings macroId="macro-123" />);

    expect(screen.getByTestId("initial-description")).toHaveTextContent("");
  });

  it("should call useMacro with correct macroId", () => {
    mockUseMacro.mockReturnValue({
      data: mockMacro,
      isLoading: false,
    });

    render(<MacroSettings macroId="test-macro-id" />);

    expect(mockUseMacro).toHaveBeenCalledWith("test-macro-id");
  });

  it("should have proper layout structure with spacing", () => {
    mockUseMacro.mockReturnValue({
      data: mockMacro,
      isLoading: false,
    });

    const { container } = render(<MacroSettings macroId="macro-123" />);

    const mainDiv = container.firstChild as HTMLElement;
    expect(mainDiv).toHaveClass("space-y-6");
  });

  it("should render cards in correct order (details first, info second)", () => {
    mockUseMacro.mockReturnValue({
      data: mockMacro,
      isLoading: false,
    });

    render(<MacroSettings macroId="macro-123" />);

    const cards = screen.getAllByTestId(/(macro-details-card|macro-info-card)/);
    expect(cards[0]).toHaveAttribute("data-testid", "macro-details-card");
    expect(cards[1]).toHaveAttribute("data-testid", "macro-info-card");
  });

  it("should handle different macro languages", () => {
    const rMacro = {
      ...mockMacro,
      language: "r" as const,
    };

    mockUseMacro.mockReturnValue({
      data: rMacro,
      isLoading: false,
    });

    render(<MacroSettings macroId="macro-123" />);

    expect(screen.getByTestId("initial-language")).toHaveTextContent("r");
  });

  it("should handle JavaScript macro language", () => {
    const jsMacro = {
      ...mockMacro,
      language: "javascript" as const,
    };

    mockUseMacro.mockReturnValue({
      data: jsMacro,
      isLoading: false,
    });

    render(<MacroSettings macroId="macro-123" />);

    expect(screen.getByTestId("initial-language")).toHaveTextContent("javascript");
  });
});
