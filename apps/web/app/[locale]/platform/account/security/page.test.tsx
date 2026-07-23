import { render, screen } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import SecurityPage from "./page";

vi.mock("~/components/account-settings/passkeys/passkeys-card", () => ({
  PasskeysCard: () => <div data-testid="passkeys-card">Passkeys</div>,
}));

vi.mock("~/components/account-settings/security/sign-in-methods-card", () => ({
  SignInMethodsCard: () => <div data-testid="sign-in-methods-card">Sign-in methods</div>,
}));

describe("SecurityPage", () => {
  it("renders the sign-in methods overview and the passkeys card", () => {
    render(<SecurityPage />);

    expect(screen.getByTestId("sign-in-methods-card")).toBeInTheDocument();
    expect(screen.getByTestId("passkeys-card")).toBeInTheDocument();
  });
});
