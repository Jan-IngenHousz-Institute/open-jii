import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { vi, describe, it, expect, beforeEach } from "vitest";

import { MacroInfoCard } from "./macro-info-card";

// Mock the delete mutation function
const mockDeleteMutate = vi.fn().mockImplementation(() => Promise.resolve());

// Mock useMacroDelete
vi.mock("@/hooks/macro/useMacroDelete/useMacroDelete", () => ({
  useMacroDelete: () => ({
    mutateAsync: mockDeleteMutate,
    isPending: false,
  }),
}));

// Set up mocks before tests
const mockPush = vi.fn();

// Mock useTranslation
vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock useLocale
vi.mock("@/hooks/useLocale", () => ({
  useLocale: () => "en",
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock formatDate
vi.mock("@/util/date", () => ({
  formatDate: (dateString: string) => `formatted-${dateString}`,
}));

describe("MacroInfoCard", () => {
  const mockMacro = {
    id: "macro-123",
    name: "Test Macro",
    description: "Test description",
    language: "python" as const,
    createdBy: "user-123",
    createdByName: "Test User",
    createdAt: "2023-01-01T00:00:00Z",
    updatedAt: "2023-01-02T00:00:00Z",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockPush.mockClear();
    mockDeleteMutate.mockClear();
  });

  it("should render the macro info card with correct data", () => {
    render(<MacroInfoCard macroId="macro-123" macro={mockMacro} />);

    // Check titles
    expect(screen.getByText("macroSettings.macroInfo")).toBeInTheDocument();
    expect(screen.getByText("macroSettings.macroInfoDescription")).toBeInTheDocument();

    // Check creation and update dates
    expect(screen.getByText("macroSettings.created:")).toBeInTheDocument();
    expect(screen.getByText(/formatted-2023-01-01T00:00:00Z/)).toBeInTheDocument();
    expect(screen.getByText("macroSettings.updated:")).toBeInTheDocument();
    expect(screen.getByText(/formatted-2023-01-02T00:00:00Z/)).toBeInTheDocument();

    // Check ID
    expect(screen.getByText("macros.macroId:")).toBeInTheDocument();
    expect(screen.getByText("macro-123")).toBeInTheDocument();
  });

  it("should render the danger zone section", () => {
    render(<MacroInfoCard macroId="macro-123" macro={mockMacro} />);

    expect(screen.getByText("macroSettings.dangerZone")).toBeInTheDocument();
    expect(screen.getByText("macroSettings.deleteWarning")).toBeInTheDocument();
    expect(screen.getByText("macroSettings.deleteMacro")).toBeInTheDocument();
  });

  it("should open the delete confirmation dialog when delete button is clicked", () => {
    render(<MacroInfoCard macroId="macro-123" macro={mockMacro} />);

    const deleteButton = screen.getByText("macroSettings.deleteMacro");
    fireEvent.click(deleteButton);

    // The dialog text is broken up into multiple elements, so we use a more flexible approach
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveTextContent("macroSettings.confirmDelete");
    expect(dialog).toHaveTextContent("Test Macro");
    expect(screen.getByText("macroSettings.cancel")).toBeInTheDocument();
    expect(screen.getByText("macroSettings.delete")).toBeInTheDocument();
  });

  it("should close the dialog when cancel is clicked", () => {
    render(<MacroInfoCard macroId="macro-123" macro={mockMacro} />);

    // Open the dialog
    const deleteButton = screen.getByText("macroSettings.deleteMacro");
    fireEvent.click(deleteButton);

    // Check that the dialog is open
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveTextContent("macroSettings.confirmDelete");
    expect(dialog).toHaveTextContent("Test Macro");

    // Click cancel
    const cancelButton = screen.getByText("macroSettings.cancel");
    fireEvent.click(cancelButton);

    // Dialog should be closed
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("should handle delete when confirmed", async () => {
    // Clear previous mock calls
    mockPush.mockReset();

    render(<MacroInfoCard macroId="macro-123" macro={mockMacro} />);

    // Open the dialog
    const deleteButton = screen.getByText("macroSettings.deleteMacro");
    fireEvent.click(deleteButton);

    // Click delete
    const confirmDeleteButton = screen.getByText("macroSettings.delete");
    fireEvent.click(confirmDeleteButton);

    // Wait for the async operation to complete
    await waitFor(() => {
      expect(mockDeleteMutate).toHaveBeenCalledWith({ params: { id: "macro-123" } });
      expect(mockPush).toHaveBeenCalledWith("/en/platform/macros");
    });
  });
});
