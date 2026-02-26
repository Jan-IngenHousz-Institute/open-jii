import { createProtocol } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor, fireEvent } from "@/test/test-utils";
import { useRouter } from "next/navigation";
import { describe, it, expect, vi } from "vitest";

import { contract } from "@repo/api";
import { toast } from "@repo/ui/hooks";

import { NewProtocolForm } from "../new-protocol";

// ProtocolCodeEditor — pragmatic mock (Monaco editor doesn't work in jsdom)
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

// NewProtocolDetailsCard — sibling component (Rule 5)
// Uses form.register to connect the name field to react-hook-form
vi.mock("../new-protocol-details-card", () => ({
  NewProtocolDetailsCard: ({
    form,
  }: {
    form: { register: (name: string) => Record<string, unknown> };
  }) => (
    <div>
      <label htmlFor="proto-name">Name</label>
      <input id="proto-name" {...form.register("name")} />
    </div>
  ),
}));

describe("NewProtocolForm", () => {
  it("renders form sections and buttons", () => {
    render(<NewProtocolForm />);
    expect(screen.getByText("newProtocol.codeTitle")).toBeInTheDocument();
    expect(screen.getByText("newProtocol.codeDescription")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /finalizeSetup/i })).toBeInTheDocument();
  });

  it("disables submit when form is pristine", () => {
    render(<NewProtocolForm />);
    expect(screen.getByRole("button", { name: /finalizeSetup/i })).toBeDisabled();
  });

  it("navigates back when cancel is clicked", async () => {
    render(<NewProtocolForm />);
    await userEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(vi.mocked(useRouter)().back).toHaveBeenCalled();
  });

  it("disables submit when code is invalid", async () => {
    render(<NewProtocolForm />);

    await userEvent.type(screen.getByLabelText("Name"), "Test Protocol");
    fireEvent.input(screen.getByRole("textbox", { name: /code editor/i }), {
      target: { value: "{ invalid json" },
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /finalizeSetup/i })).toBeDisabled();
    });
  });

  it("creates protocol, shows toast, and navigates on success", async () => {
    const protocol = createProtocol({ id: "new-protocol-id" });
    const spy = server.mount(contract.protocols.createProtocol, { body: protocol });

    render(<NewProtocolForm />);

    await userEvent.type(screen.getByLabelText("Name"), "Test Protocol");
    fireEvent.input(screen.getByRole("textbox", { name: /code editor/i }), {
      target: { value: JSON.stringify([{ averages: 1 }]) },
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /finalizeSetup/i })).not.toBeDisabled();
    });

    await userEvent.click(screen.getByRole("button", { name: /finalizeSetup/i }));

    expect(vi.mocked(toast)).toHaveBeenCalledWith({
      description: "protocols.protocolCreated",
    });

    await waitFor(() => {
      expect(spy.callCount).toBe(1);
    });

    await waitFor(() => {
      expect(vi.mocked(useRouter)().push).toHaveBeenCalledWith(
        "/en-US/platform/protocols/new-protocol-id",
      );
    });
  });

  it("initializes code editor with default value", () => {
    render(<NewProtocolForm />);
    expect(screen.getByRole("textbox", { name: /code editor/i })).toHaveValue(JSON.stringify([{}]));
  });

  it("updates code field via editor", () => {
    render(<NewProtocolForm />);
    const newCode = JSON.stringify([{ averages: 2 }]);
    fireEvent.input(screen.getByRole("textbox", { name: /code editor/i }), {
      target: { value: newCode },
    });
    expect(screen.getByRole("textbox", { name: /code editor/i })).toHaveValue(newCode);
  });
});
