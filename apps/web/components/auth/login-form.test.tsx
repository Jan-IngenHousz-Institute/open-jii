import { render, screen } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { LoginForm } from "./login-form";

vi.mock("./email-login-form", () => ({
  EmailLoginForm: (props: { callbackUrl?: string; locale: string }) => (
    <div
      data-testid="email-login-form"
      data-callback={props.callbackUrl}
      data-locale={props.locale}
    />
  ),
}));

vi.mock("./oauth-login-form", () => ({
  OAuthLoginForm: (props: { provider: { id: string; name: string }; layoutCount?: number }) => (
    <div data-testid={`oauth-${props.provider.id}`} data-layout={props.layoutCount}>
      {props.provider.name}
    </div>
  ),
}));

const termsData = { title: "Terms Title", content: "Terms Content" };

describe("LoginForm", () => {
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
});
