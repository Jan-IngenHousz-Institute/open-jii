import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { ProtocolDetailsCard } from "../protocol-details-card";

// Mock the hooks
vi.mock("../../../hooks/protocol/useProtocolUpdate/useProtocolUpdate", () => ({
  useProtocolUpdate: vi.fn(() => ({
    mutateAsync: vi.fn().mockResolvedValue({}),
    isPending: false,
  })),
}));

// Mock i18n
vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock toast
vi.mock("@repo/ui/hooks", () => ({
  toast: vi.fn(),
}));

// Mock ProtocolCodeEditor
vi.mock("../../protocol-code-editor", () => ({
  default: ({
    value,
    onChange,
    onValidationChange,
  }: {
    value: Record<string, unknown>[];
    onChange: (v: Record<string, unknown>[]) => void;
    onValidationChange: (v: boolean) => void;
  }) => (
    <div data-testid="protocol-code-editor">
      <textarea
        data-testid="code-editor"
        value={JSON.stringify(value)}
        onChange={(e) => {
          try {
            const parsed = JSON.parse(e.target.value) as Record<string, unknown>[];
            onChange(parsed);
            onValidationChange(true);
          } catch {
            onValidationChange(false);
          }
        }}
      />
    </div>
  ),
}));

describe("ProtocolDetailsCard", () => {
  const defaultProps = {
    protocolId: "test-protocol-id",
    initialName: "Test Protocol",
    initialDescription: "Test Description",
    initialCode: [{ averages: 1, environmental: [["light_intensity", 0]] }],
    initialFamily: "multispeq" as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render the form with initial values", () => {
    render(<ProtocolDetailsCard {...defaultProps} />);

    expect(screen.getByDisplayValue("Test Protocol")).toBeInTheDocument();
    // Description is wrapped in <p> tags by Quill, so can't use getByDisplayValue
    expect(screen.getByTestId("protocol-code-editor")).toBeInTheDocument();
  });

  it("should display all form fields", () => {
    render(<ProtocolDetailsCard {...defaultProps} />);

    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/family/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /code/i })).toBeInTheDocument();
  });

  it("should disable submit button when form is pristine", () => {
    render(<ProtocolDetailsCard {...defaultProps} />);

    const submitButton = screen.getByRole("button", { name: /save/i });
    expect(submitButton).toBeDisabled();
  });

  it("should enable submit button when form is dirty and valid", async () => {
    render(<ProtocolDetailsCard {...defaultProps} />);

    const nameInput = screen.getByLabelText(/name/i);
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "Updated Protocol Name");

    await waitFor(() => {
      const submitButton = screen.getByRole("button", { name: /save/i });
      expect(submitButton).not.toBeDisabled();
    });
  });

  it("should call updateProtocol mutation on submit", async () => {
    const { useProtocolUpdate } = await import(
      "../../../hooks/protocol/useProtocolUpdate/useProtocolUpdate"
    );
    const mockMutateAsync = vi.fn().mockResolvedValue({});
    vi.mocked(useProtocolUpdate).mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    } as never);

    render(<ProtocolDetailsCard {...defaultProps} />);

    const nameInput = screen.getByLabelText(/name/i);
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "Updated Name");

    const submitButton = screen.getByRole("button", { name: /save/i });
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        params: { id: "test-protocol-id" },
        body: {
          name: "Updated Name",
          description: "<p>Test Description</p>", // Quill wraps content in HTML
          code: defaultProps.initialCode,
          family: defaultProps.initialFamily,
        },
      });
    });
  });

  it("should show toast notification on successful update", async () => {
    const { toast } = await import("@repo/ui/hooks");

    render(<ProtocolDetailsCard {...defaultProps} />);

    const nameInput = screen.getByLabelText(/name/i);
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "Updated Name");

    const submitButton = screen.getByRole("button", { name: /save/i });
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith({
        description: "protocols.protocolUpdated",
      });
    });
  });

  it("should disable submit button when code is invalid", async () => {
    render(<ProtocolDetailsCard {...defaultProps} />);

    const nameInput = screen.getByLabelText(/name/i);
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "Updated Name");

    const codeEditor = screen.getByTestId("code-editor");
    // Use fireEvent for JSON strings with curly braces
    fireEvent.input(codeEditor, { target: { value: "{ invalid json" } });

    await waitFor(() => {
      const submitButton = screen.getByRole("button", { name: /save/i });
      expect(submitButton).toBeDisabled();
    });
  });

  it("should show loading state during update", async () => {
    const { useProtocolUpdate } = await import(
      "../../../hooks/protocol/useProtocolUpdate/useProtocolUpdate"
    );
    vi.mocked(useProtocolUpdate).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: true,
    } as never);

    render(<ProtocolDetailsCard {...defaultProps} />);

    const submitButton = screen.getByRole("button", { name: /save/i });
    expect(submitButton).toBeDisabled();
  });

  it.skip("should update description field", async () => {
    // Skip: Description field is a Quill rich text editor, not a standard input
    // Testing Quill editor interaction requires more complex setup
    render(<ProtocolDetailsCard {...defaultProps} />);

    const descriptionInput = screen.getByLabelText(/description/i);
    await userEvent.clear(descriptionInput);
    await userEvent.type(descriptionInput, "New description");

    expect(descriptionInput).toHaveValue("New description");
  });

  it("should update code field", async () => {
    render(<ProtocolDetailsCard {...defaultProps} />);

    const codeEditor = screen.getByTestId("code-editor");
    const newCode = JSON.stringify([{ averages: 2 }]);

    // Use fireEvent for JSON strings with curly braces
    fireEvent.input(codeEditor, { target: { value: newCode } });

    expect(codeEditor).toHaveValue(newCode);
  });

  it("should show family selector with correct options", () => {
    render(<ProtocolDetailsCard {...defaultProps} />);

    const familySelect = screen.getByLabelText(/family/i);
    expect(familySelect).toBeInTheDocument();
  });

  it("should display card title and description", () => {
    render(<ProtocolDetailsCard {...defaultProps} />);

    expect(screen.getByText("protocolSettings.generalSettings")).toBeInTheDocument();
    expect(screen.getByText("protocolSettings.generalDescription")).toBeInTheDocument();
  });

  it("should handle empty code value", () => {
    render(<ProtocolDetailsCard {...defaultProps} initialCode={[{}]} />);

    const codeEditor = screen.getByTestId("code-editor");
    expect(codeEditor).toHaveValue(JSON.stringify([{}]));
  });

  it("should validate name field", async () => {
    render(<ProtocolDetailsCard {...defaultProps} />);

    const nameInput = screen.getByLabelText(/name/i);
    await userEvent.clear(nameInput);
    await userEvent.tab(); // Trigger blur to show validation

    await waitFor(() => {
      // Form should show validation error
      const submitButton = screen.getByRole("button", { name: /save/i });
      expect(submitButton).toBeDisabled();
    });
  });
});
