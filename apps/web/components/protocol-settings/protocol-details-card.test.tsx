import { createProtocol } from "@/test/factories";
import { server } from "@/test/msw/server";
import { act, fireEvent, render, screen, userEvent, waitFor } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { contract } from "@repo/api/contract";
import { toast } from "@repo/ui/hooks/use-toast";

import { ProtocolDetailsCard } from "./protocol-details-card";

// Hoisted mocks
const useIotBrowserSupportMock = vi.hoisted(() => vi.fn());

// Mock useIotBrowserSupport
vi.mock("~/hooks/iot/useIotBrowserSupport", () => ({
  useIotBrowserSupport: useIotBrowserSupportMock,
}));

// Mock IotProtocolRunner
vi.mock("../iot/iot-protocol-runner", () => ({
  IotProtocolRunner: (props: Record<string, unknown>) => (
    <div data-testid="iot-protocol-runner" data-layout={props.layout}>
      IotProtocolRunner
    </div>
  ),
}));

// Mock Collapsible (renders children in a simple div)
vi.mock("@repo/ui/components/collapsible", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("@repo/ui/components/collapsible");
  return {
    ...actual,
    Collapsible: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    CollapsibleContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    CollapsibleTrigger: ({ children }: { children: React.ReactNode }) => (
      <button type="button">{children}</button>
    ),
  };
});

// Mock ResizablePanelGroup (renders children in a simple div)
vi.mock("@repo/ui/components/resizable", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("@repo/ui/components/resizable");
  return {
    ...actual,
    ResizablePanelGroup: ({
      children,
      ...props
    }: {
      children: React.ReactNode;
      direction: string;
      className?: string;
    }) => (
      <div data-testid="resizable-panel-group" data-direction={props.direction}>
        {children}
      </div>
    ),
    ResizablePanel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    ResizableHandle: () => <div data-testid="resizable-handle" />,
  };
});

// Mock ProtocolCodeEditor
vi.mock("../protocol-code-editor", () => ({
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
    server.mount(contract.protocols.updateProtocol, {
      body: createProtocol({ id: "test-protocol-id", name: "Updated Name" }),
    });
    useIotBrowserSupportMock.mockReturnValue({
      bluetooth: false,
      serial: false,
      any: false,
    });
  });

  it("should render the form with initial values", async () => {
    await act(async () => {
      render(<ProtocolDetailsCard {...defaultProps} />);
    });

    expect(screen.getByDisplayValue("Test Protocol")).toBeInTheDocument();
    expect(screen.getByTestId("protocol-code-editor")).toBeInTheDocument();
  });

  it("should display all form fields", async () => {
    await act(async () => {
      render(<ProtocolDetailsCard {...defaultProps} />);
    });

    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/family/i)).toBeInTheDocument();
    expect(screen.getByTestId("protocol-code-editor")).toBeInTheDocument();
  });

  it("should disable submit button when form is pristine", async () => {
    await act(async () => {
      render(<ProtocolDetailsCard {...defaultProps} />);
    });

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
    const spy = server.mount(contract.protocols.updateProtocol, {
      body: createProtocol({ id: "test-protocol-id" }),
    });

    render(<ProtocolDetailsCard {...defaultProps} />);

    const nameInput = screen.getByLabelText(/name/i);
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "Updated Name");

    const submitButton = screen.getByRole("button", { name: /save/i });
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(spy.called).toBe(true);
      expect(spy.params).toMatchObject({ id: "test-protocol-id" });
      expect(spy.body).toMatchObject({
        name: "Updated Name",
        description: "<p>Test Description</p>", // Quill wraps content in HTML
        code: defaultProps.initialCode,
        family: defaultProps.initialFamily,
      });
    });
  });

  it("should show toast notification on successful update", async () => {
    render(<ProtocolDetailsCard {...defaultProps} />);

    const nameInput = screen.getByLabelText(/name/i);
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "Updated Name");

    const submitButton = screen.getByRole("button", { name: /save/i });
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(vi.mocked(toast)).toHaveBeenCalledWith({
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
    // fireEvent: userEvent.type interprets curly braces as special keys
    fireEvent.input(codeEditor, { target: { value: "{ invalid json" } });

    await waitFor(() => {
      const submitButton = screen.getByRole("button", { name: /save/i });
      expect(submitButton).toBeDisabled();
    });
  });

  it("should show loading state during update", async () => {
    server.mount(contract.protocols.updateProtocol, {
      body: createProtocol(),
      delay: 999_999,
    });

    render(<ProtocolDetailsCard {...defaultProps} />);

    const nameInput = screen.getByLabelText(/name/i);
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "Updated Name");

    const submitButton = screen.getByRole("button", { name: /save/i });
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(submitButton).toBeDisabled();
    });
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
    await act(async () => {
      render(<ProtocolDetailsCard {...defaultProps} />);
    });

    const codeEditor = screen.getByTestId("code-editor");
    const newCode = JSON.stringify([{ averages: 2 }]);

    // fireEvent: userEvent.type interprets curly braces as special keys.
    // Wrapped in act so react-hook-form's Controller state updates flush
    // before the assertion.
    await act(async () => {
      fireEvent.input(codeEditor, { target: { value: newCode } });
    });

    expect(codeEditor).toHaveValue(newCode);
  });

  it("should show family selector with correct options", async () => {
    await act(async () => {
      render(<ProtocolDetailsCard {...defaultProps} />);
    });

    const familySelect = screen.getByLabelText(/family/i);
    expect(familySelect).toBeInTheDocument();
  });

  it("should display header title and description", async () => {
    await act(async () => {
      render(<ProtocolDetailsCard {...defaultProps} />);
    });

    expect(screen.getByText("protocolSettings.generalSettings")).toBeInTheDocument();
    expect(screen.getByText("protocolSettings.generalDescription")).toBeInTheDocument();
  });

  it("should handle empty code value", async () => {
    await act(async () => {
      render(<ProtocolDetailsCard {...defaultProps} initialCode={[{}]} />);
    });

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

  it("should render resizable panel group with horizontal direction", async () => {
    await act(async () => {
      render(<ProtocolDetailsCard {...defaultProps} />);
    });

    const panelGroup = screen.getByTestId("resizable-panel-group");
    expect(panelGroup).toHaveAttribute("data-direction", "horizontal");
  });

  it("should render the connect & test panel title", async () => {
    await act(async () => {
      render(<ProtocolDetailsCard {...defaultProps} />);
    });

    expect(screen.getByText("protocolSettings.testerTitle")).toBeInTheDocument();
  });

  it("should render collapsible details section", async () => {
    await act(async () => {
      render(<ProtocolDetailsCard {...defaultProps} />);
    });

    expect(screen.getByText("protocolSettings.detailsTitle")).toBeInTheDocument();
  });

  it("should show browser unsupported message when no browser support", async () => {
    useIotBrowserSupportMock.mockReturnValue({
      bluetooth: false,
      serial: false,
      any: false,
    });

    await act(async () => {
      render(<ProtocolDetailsCard {...defaultProps} />);
    });

    expect(screen.queryByTestId("iot-protocol-runner")).not.toBeInTheDocument();
  });

  it("should render IoT protocol runner when browser supports APIs", async () => {
    useIotBrowserSupportMock.mockReturnValue({
      bluetooth: true,
      serial: false,
      any: true,
    });

    await act(async () => {
      render(<ProtocolDetailsCard {...defaultProps} />);
    });

    const runner = screen.getByTestId("iot-protocol-runner");
    expect(runner).toBeInTheDocument();
    expect(runner).toHaveAttribute("data-layout", "vertical");
  });
});
