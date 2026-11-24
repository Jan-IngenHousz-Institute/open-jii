import { render, screen } from "@/test/test-utils";
import { ReadonlyURLSearchParams, usePathname, useSearchParams } from "next/navigation";
import { describe, expect, it, vi } from "vitest";

import SecurityPage from "./page";

vi.mock("~/components/account-settings/passkeys/passkeys-card", () => ({
  PasskeysCard: () => <div data-testid="passkeys-card">Passkeys</div>,
}));

vi.mock("~/components/account-settings/security/sign-in-methods-card", () => ({
  SignInMethodsCard: () => <div data-testid="sign-in-methods-card">Sign-in methods</div>,
}));

describe("SecurityPage", () => {
  it("renders the connect result above the sign-in methods overview, then the passkeys card", () => {
    vi.mocked(usePathname).mockReturnValue("/en-US/platform/account/security");
    vi.mocked(useSearchParams).mockReturnValue(new ReadonlyURLSearchParams("connected=orcid"));

    render(<SecurityPage />);

    const banner = screen.getByRole("alert");
    expect(banner).toHaveTextContent("signInMethods.connectedOrcidTitle");
    const card = screen.getByTestId("sign-in-methods-card");
    expect(banner.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByTestId("passkeys-card")).toBeInTheDocument();
  });
});
