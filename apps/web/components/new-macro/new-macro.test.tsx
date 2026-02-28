import { createMacro, createUserProfile } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, waitFor, userEvent } from "@/test/test-utils";
import * as base64Utils from "@/util/base64";
import { describe, it, expect, vi } from "vitest";

import { contract } from "@repo/api";
import { useSession } from "@repo/auth/client";
import { toast } from "@repo/ui/hooks";

import { NewMacroForm } from "./new-macro";

vi.mock("@hookform/resolvers/zod", () => ({
  zodResolver: () => (values: Record<string, unknown>) => ({ values, errors: {} }),
}));

vi.mock("@/util/base64", () => ({
  encodeBase64: vi.fn((s: string) => Buffer.from(s).toString("base64")),
}));

vi.mock("./new-macro-details-card", () => ({
  NewMacroDetailsCard: () => <div data-testid="details-card" />,
}));

vi.mock("../macro-code-editor", () => ({
  default: (props: Record<string, unknown>) => (
    <div
      data-testid="code-editor"
      data-language={String(props.language)}
      data-macro-name={String(props.macroName)}
    />
  ),
}));

vi.mocked(useSession).mockReturnValue({
  data: { user: { id: "user-1" } },
  isPending: false,
} as ReturnType<typeof useSession>);

describe("NewMacroForm", () => {
  it("renders form structure", async () => {
    server.mount(contract.users.getUserProfile, { body: createUserProfile() });

    render(<NewMacroForm />);

    expect(screen.getByTestId("details-card")).toBeInTheDocument();
    expect(screen.getByText("newMacro.codeTitle")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId("code-editor")).toBeInTheDocument();
    });
  });

  it("renders cancel and submit buttons", () => {
    render(<NewMacroForm />);
    expect(screen.getByText("newMacro.cancel")).toBeInTheDocument();
    expect(screen.getByText("newMacro.finalizeSetup")).toBeInTheDocument();
  });

  it("navigates back on cancel", async () => {
    const user = userEvent.setup();
    const { router } = render(<NewMacroForm />);
    await user.click(screen.getByText("newMacro.cancel"));
    expect(router.back).toHaveBeenCalled();
  });

  it("submits form — POST /api/v1/macros", async () => {
    server.mount(contract.users.getUserProfile, { body: createUserProfile() });

    const spy = server.mount(contract.macros.createMacro, {
      body: createMacro({ id: "macro-42", name: "New Macro", code: "" }),
    });

    const user = userEvent.setup();
    const { router } = render(<NewMacroForm />);
    await user.click(screen.getByText("newMacro.finalizeSetup"));

    await waitFor(() => {
      expect(spy.called).toBe(true);
    });
    expect(vi.mocked(base64Utils.encodeBase64)).toHaveBeenCalled();
    expect(vi.mocked(toast)).toHaveBeenCalledWith({ description: "macros.macroCreated" });

    // onSuccess navigates to the new macro
    await waitFor(() => {
      expect(router.push).toHaveBeenCalled();
    });
  });

  it("renders code editor with default language", async () => {
    server.mount(contract.users.getUserProfile, { body: createUserProfile() });

    render(<NewMacroForm />);
    await waitFor(() => {
      expect(screen.getByTestId("code-editor")).toBeInTheDocument();
    });
    expect(screen.getByTestId("code-editor")).toHaveAttribute("data-language", "python");
  });
});
