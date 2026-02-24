import { render, screen } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { MacroSettings } from "./macro-settings";

const mockUseMacro = vi.fn();
vi.mock("../../hooks/macro/useMacro/useMacro", () => ({
  useMacro: (...args: [string]) => {
    mockUseMacro(...args);
    return mockUseMacro();
  },
}));

vi.mock("./macro-details-card", () => ({
  MacroDetailsCard: (props: Record<string, unknown>) => (
    <div data-testid="macro-details-card" data-macro-id={props.macroId} />
  ),
}));
vi.mock("./macro-info-card", () => ({
  MacroInfoCard: (props: Record<string, unknown>) => (
    <div data-testid="macro-info-card" data-macro-id={props.macroId} />
  ),
}));

const mockMacro = {
  id: "m-1",
  name: "Test Macro",
  description: "Desc",
  language: "python" as const,
  code: btoa("print('hi')"),
};

describe("MacroSettings", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows loading state", () => {
    mockUseMacro.mockReturnValue({ data: null, isLoading: true });
    render(<MacroSettings macroId="m-1" />);
    expect(screen.getByText("macroSettings.loading")).toBeInTheDocument();
  });

  it("shows not-found when no data", () => {
    mockUseMacro.mockReturnValue({ data: null, isLoading: false });
    render(<MacroSettings macroId="m-1" />);
    expect(screen.getByText("macroSettings.notFound")).toBeInTheDocument();
  });

  it("renders detail and info cards when data is available", () => {
    mockUseMacro.mockReturnValue({ data: mockMacro, isLoading: false });
    render(<MacroSettings macroId="m-1" />);
    expect(screen.getByTestId("macro-details-card")).toBeInTheDocument();
    expect(screen.getByTestId("macro-info-card")).toBeInTheDocument();
  });

  it("calls useMacro with the provided macroId", () => {
    mockUseMacro.mockReturnValue({ data: mockMacro, isLoading: false });
    render(<MacroSettings macroId="test-id" />);
    expect(mockUseMacro).toHaveBeenCalledWith("test-id");
  });
});
