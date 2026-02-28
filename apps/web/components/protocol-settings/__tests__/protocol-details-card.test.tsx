import { createProtocol } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor, fireEvent } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";

import { contract } from "@repo/api";
import { toast } from "@repo/ui/hooks";

import { ProtocolDetailsCard } from "../protocol-details-card";

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
    <textarea
      aria-label="code editor"
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
  ),
}));

const defaultProps = {
  protocolId: "test-protocol-id",
  initialName: "Test Protocol",
  initialDescription: "Test Description",
  initialCode: [{ averages: 1, environmental: [["light_intensity", 0]] }],
  initialFamily: "multispeq" as const,
};

describe("ProtocolDetailsCard", () => {
  it("renders form with initial values", async () => {
    render(<ProtocolDetailsCard {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByDisplayValue("Test Protocol")).toBeInTheDocument();
    });
    expect(screen.getByRole("textbox", { name: /code editor/i })).toBeInTheDocument();
  });

  it("displays all form fields", async () => {
    render(<ProtocolDetailsCard {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    });
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/family/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /code/i })).toBeInTheDocument();
  });

  it("disables save when form is pristine", async () => {
    render(<ProtocolDetailsCard {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /save/i })).toBeDisabled();
    });
  });

  it("enables save when form is dirty and valid", async () => {
    render(<ProtocolDetailsCard {...defaultProps} />);
    await userEvent.clear(screen.getByLabelText(/name/i));
    await userEvent.type(screen.getByLabelText(/name/i), "Updated Protocol");

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /save/i })).not.toBeDisabled();
    });
  });

  it("submits updated protocol and shows toast", async () => {
    const spy = server.mount(contract.protocols.updateProtocol, {
      body: createProtocol({ name: "Updated Name" }),
    });

    render(<ProtocolDetailsCard {...defaultProps} />);

    await userEvent.clear(screen.getByLabelText(/name/i));
    await userEvent.type(screen.getByLabelText(/name/i), "Updated Name");
    await userEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(spy.callCount).toBe(1);
    });
    expect(spy.body).toMatchObject({ name: "Updated Name" });
    expect(vi.mocked(toast)).toHaveBeenCalledWith({
      description: "protocols.protocolUpdated",
    });
  });

  it("disables save when code is invalid", async () => {
    render(<ProtocolDetailsCard {...defaultProps} />);
    await userEvent.clear(screen.getByLabelText(/name/i));
    await userEvent.type(screen.getByLabelText(/name/i), "Updated");

    // fireEvent.input for JSON with curly braces (userEvent interprets { as modifier)
    fireEvent.input(screen.getByRole("textbox", { name: /code editor/i }), {
      target: { value: "{ invalid json" },
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /save/i })).toBeDisabled();
    });
  });

  it("updates code field", async () => {
    render(<ProtocolDetailsCard {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByRole("textbox", { name: /code editor/i })).toBeInTheDocument();
    });
    const newCode = JSON.stringify([{ averages: 2 }]);
    fireEvent.input(screen.getByRole("textbox", { name: /code editor/i }), {
      target: { value: newCode },
    });
    expect(screen.getByRole("textbox", { name: /code editor/i })).toHaveValue(newCode);
  });

  it("validates name as required", async () => {
    render(<ProtocolDetailsCard {...defaultProps} />);
    await userEvent.clear(screen.getByLabelText(/name/i));
    await userEvent.tab();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /save/i })).toBeDisabled();
    });
  });

  it("displays card title and description", async () => {
    render(<ProtocolDetailsCard {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("protocolSettings.generalSettings")).toBeInTheDocument();
    });
    expect(screen.getByText("protocolSettings.generalDescription")).toBeInTheDocument();
  });
});
