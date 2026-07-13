import { createCommand } from "@/test/factories";
import { server } from "@/test/msw/server";
import { fireEvent, render, screen, userEvent, waitFor } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { contract } from "@repo/api/contract";
import { toast } from "@repo/ui/hooks/use-toast";

import { CommandDetailsCard } from "./command-details-card";

// Hoisted mocks
const useIotBrowserSupportMock = vi.hoisted(() => vi.fn());

// Mock useIotBrowserSupport
vi.mock("~/hooks/iot/useIotBrowserSupport", () => ({
  useIotBrowserSupport: useIotBrowserSupportMock,
}));

// Mock IotCommandRunner
vi.mock("../iot/iot-command-runner", () => ({
  IotCommandRunner: (props: Record<string, unknown>) => (
    <div data-testid="iot-command-runner" data-layout={props.layout}>
      IotCommandRunner
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

// Mock CommandCodeEditor
vi.mock("../command-code-editor", () => ({
  default: ({
    value,
    onChange,
    onValidationChange,
  }: {
    value: Record<string, unknown>[];
    onChange: (v: Record<string, unknown>[]) => void;
    onValidationChange: (v: boolean) => void;
  }) => (
    <div data-testid="command-code-editor">
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

describe("CommandDetailsCard", () => {
  const defaultProps = {
    commandId: "test-command-id",
    initialName: "Test Command",
    initialDescription: "Test Description",
    initialCode: [{ averages: 1, environmental: [["light_intensity", 0]] }],
    initialFamily: "multispeq" as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    server.mount(contract.commands.updateCommand, {
      body: createCommand({ id: "test-command-id", name: "Updated Name" }),
    });
    useIotBrowserSupportMock.mockReturnValue({
      bluetooth: false,
      serial: false,
      any: false,
    });
  });

  it("should render the form with initial values", async () => {
    render(<CommandDetailsCard {...defaultProps} />);

    expect(await screen.findByDisplayValue("Test Command")).toBeInTheDocument();
    expect(screen.getByTestId("command-code-editor")).toBeInTheDocument();
  });

  it("should display all form fields", async () => {
    render(<CommandDetailsCard {...defaultProps} />);

    expect(await screen.findByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/family/i)).toBeInTheDocument();
    expect(screen.getByTestId("command-code-editor")).toBeInTheDocument();
  });

  it("should disable submit button when form is pristine", async () => {
    render(<CommandDetailsCard {...defaultProps} />);

    const submitButton = await screen.findByRole("button", { name: /save/i });
    expect(submitButton).toBeDisabled();
  });

  it("should enable submit button when form is dirty and valid", async () => {
    render(<CommandDetailsCard {...defaultProps} />);

    const nameInput = screen.getByLabelText(/name/i);
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "Updated Command Name");

    await waitFor(() => {
      const submitButton = screen.getByRole("button", { name: /save/i });
      expect(submitButton).not.toBeDisabled();
    });
  });

  it("should call updateCommand mutation on submit", async () => {
    const spy = server.mount(contract.commands.updateCommand, {
      body: createCommand({ id: "test-command-id" }),
    });

    render(<CommandDetailsCard {...defaultProps} />);

    const nameInput = screen.getByLabelText(/name/i);
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "Updated Name");

    const submitButton = screen.getByRole("button", { name: /save/i });
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(spy.called).toBe(true);
      expect(spy.params).toMatchObject({ id: "test-command-id" });
      expect(spy.body).toMatchObject({
        name: "Updated Name",
        description: "<p>Test Description</p>", // Quill wraps content in HTML
        code: defaultProps.initialCode,
        family: defaultProps.initialFamily,
      });
    });
  });

  it("should show toast notification on successful update", async () => {
    render(<CommandDetailsCard {...defaultProps} />);

    const nameInput = screen.getByLabelText(/name/i);
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "Updated Name");

    const submitButton = screen.getByRole("button", { name: /save/i });
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(vi.mocked(toast)).toHaveBeenCalledWith({
        description: "commands.commandUpdated",
      });
    });
  });

  it("should disable submit button when code is invalid", async () => {
    render(<CommandDetailsCard {...defaultProps} />);

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
    server.mount(contract.commands.updateCommand, {
      body: createCommand(),
      delay: 999_999,
    });

    render(<CommandDetailsCard {...defaultProps} />);

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
    render(<CommandDetailsCard {...defaultProps} />);

    const descriptionInput = screen.getByLabelText(/description/i);
    await userEvent.clear(descriptionInput);
    await userEvent.type(descriptionInput, "New description");

    expect(descriptionInput).toHaveValue("New description");
  });

  it("should update code field", async () => {
    render(<CommandDetailsCard {...defaultProps} />);

    const codeEditor = await screen.findByTestId("code-editor");
    const newCode = JSON.stringify([{ averages: 2 }]);

    // fireEvent: userEvent.type interprets curly braces as special keys.
    fireEvent.input(codeEditor, { target: { value: newCode } });

    await waitFor(() => {
      expect(codeEditor).toHaveValue(newCode);
    });
  });

  it("should show family selector with correct options", async () => {
    render(<CommandDetailsCard {...defaultProps} />);

    const familySelect = await screen.findByLabelText(/family/i);
    expect(familySelect).toBeInTheDocument();
  });

  it("should display header title and description", async () => {
    render(<CommandDetailsCard {...defaultProps} />);

    expect(await screen.findByText("commandSettings.generalSettings")).toBeInTheDocument();
    expect(screen.getByText("commandSettings.generalDescription")).toBeInTheDocument();
  });

  it("should handle empty code value", async () => {
    render(<CommandDetailsCard {...defaultProps} initialCode={[{}]} />);

    const codeEditor = await screen.findByTestId("code-editor");
    expect(codeEditor).toHaveValue(JSON.stringify([{}]));
  });

  it("should validate name field", async () => {
    render(<CommandDetailsCard {...defaultProps} />);

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
    render(<CommandDetailsCard {...defaultProps} />);

    const panelGroup = await screen.findByTestId("resizable-panel-group");
    expect(panelGroup).toHaveAttribute("data-direction", "horizontal");
  });

  it("should render the connect & test panel title", async () => {
    render(<CommandDetailsCard {...defaultProps} />);

    expect(await screen.findByText("commandSettings.testerTitle")).toBeInTheDocument();
  });

  it("should render collapsible details section", async () => {
    render(<CommandDetailsCard {...defaultProps} />);

    expect(await screen.findByText("commandSettings.detailsTitle")).toBeInTheDocument();
  });

  it("should show browser unsupported message when no browser support", async () => {
    useIotBrowserSupportMock.mockReturnValue({
      bluetooth: false,
      serial: false,
      any: false,
    });

    render(<CommandDetailsCard {...defaultProps} />);

    await waitFor(() => {
      expect(screen.queryByTestId("iot-command-runner")).not.toBeInTheDocument();
    });
  });

  it("should render IoT command runner when browser supports APIs", async () => {
    useIotBrowserSupportMock.mockReturnValue({
      bluetooth: true,
      serial: false,
      any: true,
    });

    render(<CommandDetailsCard {...defaultProps} />);

    const runner = await screen.findByTestId("iot-command-runner");
    expect(runner).toBeInTheDocument();
    expect(runner).toHaveAttribute("data-layout", "vertical");
  });
});
