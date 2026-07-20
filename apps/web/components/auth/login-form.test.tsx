import { render, screen } from "@/test/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { authClient } from "@repo/auth/client";

import { LoginForm } from "./login-form";

vi.mock("./email-login-form", () => ({
  EmailLoginForm: (props: { callbackUrl?: string; locale: string; isLastUsed?: boolean }) => (
    <div
      data-testid="email-login-form"
      data-callback={props.callbackUrl}
      data-locale={props.locale}
      data-last-used={String(props.isLastUsed ?? false)}
    />
  ),
}));

vi.mock("./oauth-login-form", () => ({
  OAuthLoginForm: (props: {
    provider: { id: string; name: string };
    layoutCount?: number;
    isLastUsed?: boolean;
  }) => (
    <div
      data-testid={`oauth-${props.provider.id}`}
      data-layout={props.layoutCount}
      data-last-used={String(props.isLastUsed ?? false)}
    >
      {props.provider.name}
    </div>
  ),
}));

vi.mock("./passkey-login-button", () => ({
  PasskeyLoginButton: (props: { callbackUrl?: string; isLastUsed?: boolean }) => (
    <div data-testid="passkey-login-button" data-last-used={String(props.isLastUsed ?? false)} />
  ),
}));

const termsData = { title: "Terms Title", content: "Terms Content" };

describe("LoginForm", () => {
  beforeEach(() => {
    vi.stubGlobal("PublicKeyCredential", class PublicKeyCredential {});
    vi.mocked(authClient.getLastUsedLoginMethod).mockReturnValue(null);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders email form, OAuth providers, title, and divider", () => {
    render(<LoginForm callbackUrl="/cb" locale="en-US" termsData={termsData} />);

    expect(screen.getByTestId("email-login-form")).toHaveAttribute("data-callback", "/cb");
    expect(screen.getByTestId("oauth-github")).toBeInTheDocument();
    expect(screen.getByTestId("oauth-orcid")).toBeInTheDocument();
    expect(screen.getByText("auth.loginToAccount")).toBeInTheDocument();
    expect(screen.getByText("auth.or")).toBeInTheDocument();
  });

  it("passes correct layoutCount to OAuth providers", () => {
    render(<LoginForm locale="en-US" termsData={termsData} />);

    expect(screen.getByTestId("oauth-github")).toHaveAttribute("data-layout", "2");
    expect(screen.getByTestId("oauth-orcid")).toHaveAttribute("data-layout", "2");
  });

  it("renders terms and conditions section", () => {
    render(<LoginForm locale="en-US" termsData={termsData} />);

    expect(screen.getByText("auth.continueTermsPrefix")).toBeInTheDocument();
    expect(screen.getByText("auth.terms")).toBeInTheDocument();
  });

  it("marks no method as last used by default", () => {
    render(<LoginForm locale="en-US" termsData={termsData} />);

    expect(screen.getByTestId("email-login-form")).toHaveAttribute("data-last-used", "false");
    expect(screen.getByTestId("oauth-github")).toHaveAttribute("data-last-used", "false");
    expect(screen.getByTestId("passkey-login-button")).toHaveAttribute("data-last-used", "false");
  });

  it("marks the GitHub provider when it was the last used method", () => {
    vi.mocked(authClient.getLastUsedLoginMethod).mockReturnValue("github");

    render(<LoginForm locale="en-US" termsData={termsData} />);

    expect(screen.getByTestId("oauth-github")).toHaveAttribute("data-last-used", "true");
    expect(screen.getByTestId("oauth-orcid")).toHaveAttribute("data-last-used", "false");
    expect(screen.getByTestId("email-login-form")).toHaveAttribute("data-last-used", "false");
    expect(screen.getByTestId("passkey-login-button")).toHaveAttribute("data-last-used", "false");
  });

  it("marks the email form when email was the last used method", () => {
    vi.mocked(authClient.getLastUsedLoginMethod).mockReturnValue("email");

    render(<LoginForm locale="en-US" termsData={termsData} />);

    expect(screen.getByTestId("email-login-form")).toHaveAttribute("data-last-used", "true");
    expect(screen.getByTestId("oauth-github")).toHaveAttribute("data-last-used", "false");
  });

  it("marks the passkey button when passkey was the last used method", () => {
    vi.mocked(authClient.getLastUsedLoginMethod).mockReturnValue("passkey");

    render(<LoginForm locale="en-US" termsData={termsData} />);

    expect(screen.getByTestId("passkey-login-button")).toHaveAttribute("data-last-used", "true");
  });

  it("hides the passkey option when WebAuthn is unavailable", () => {
    vi.stubGlobal("PublicKeyCredential", undefined);

    render(<LoginForm locale="en-US" termsData={termsData} />);

    expect(screen.queryByTestId("passkey-login-button")).not.toBeInTheDocument();
  });
});
