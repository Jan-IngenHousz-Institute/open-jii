/**
 * NewMacroForm — MSW-based test.
 *
 * `useMacroCreate` (POST /api/v1/macros) and `useGetUserProfile`
 * (GET /api/v1/users/:id/profile) run for real with MSW intercepting
 * the HTTP requests.
 *
 * Legitimately mocked:
 *  - Children (NewMacroDetailsCard, MacroCodeEditor) — tested separately
 *  - zodResolver — children are mocked so form fields aren't interactive
 *  - next/navigation, @repo/auth/client — framework / auth, not HTTP via tsr
 *  - @repo/ui/hooks (toast), @/util/base64 — side-effects / utilities
 */
import { createMacro, createUserProfile } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, waitFor, userEvent } from "@/test/test-utils";
import * as base64Utils from "@/util/base64";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { contract } from "@repo/api";
import { toast } from "@repo/ui/hooks";

import { NewMacroForm } from "./new-macro";

vi.mock("@repo/auth/client", () => ({
  useSession: () => ({ data: { user: { id: "user-1" } } }),
}));

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

describe("NewMacroForm", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders form structure (profile loaded via MSW)", async () => {
    server.mount(contract.users.getUserProfile, { body: createUserProfile() });

    render(<NewMacroForm />);

    // Children render immediately (mocked)
    expect(screen.getByTestId("details-card")).toBeInTheDocument();
    expect(screen.getByText("newMacro.codeTitle")).toBeInTheDocument();

    // Code editor shows once user profile resolves from MSW
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

  it("submits form — POST /api/v1/macros via MSW", async () => {
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

  it("uses correct form layout", () => {
    render(<NewMacroForm />);
    expect(document.querySelector("form")).toHaveClass("space-y-8");
  });

  it("has correct button layout", () => {
    render(<NewMacroForm />);
    const container = screen.getByText("newMacro.cancel").parentElement;
    expect(container).toHaveClass("flex", "gap-2");
  });
});
