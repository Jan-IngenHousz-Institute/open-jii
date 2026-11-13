import { render, screen, userEvent } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { authClient } from "@repo/auth/client";

import { OAuthLoginForm } from "./oauth-login-form";

const mockSignInSocial = vi.mocked(authClient.signIn.social);

describe("OAuthLoginForm", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("GitHub (social)", () => {
    const github = { id: "github", name: "GitHub" };

    it("renders login button with translation key", () => {
      render(<OAuthLoginForm locale="en-US" provider={github} callbackUrl="/platform" />);
      expect(screen.getByText("auth.loginWith-github")).toBeInTheDocument();
    });

    it("calls social signIn on click", async () => {
      const user = userEvent.setup();
      render(<OAuthLoginForm locale="en-US" provider={github} callbackUrl="/dashboard" />);
      await user.click(screen.getByRole("button"));
      expect(mockSignInSocial).toHaveBeenCalledWith({
        provider: "github",
        callbackURL: "http://localhost:3000/dashboard",
        errorCallbackURL: "http://localhost:3000/login-error",
      });
    });

    it("uses default callback URL when not provided", async () => {
      const user = userEvent.setup();
      render(<OAuthLoginForm locale="en-US" provider={github} callbackUrl={undefined} />);
      await user.click(screen.getByRole("button"));
      expect(mockSignInSocial).toHaveBeenCalledWith(
        expect.objectContaining({ callbackURL: "http://localhost:3000/platform" }),
      );
    });

    it("renders GitHub SVG icon", () => {
      render(<OAuthLoginForm locale="en-US" provider={github} callbackUrl="/platform" />);
      expect(document.querySelector('svg[viewBox="0 0 24 24"]')).toBeInTheDocument();
    });
  });

  describe("ORCID (social)", () => {
    const orcid = { id: "orcid", name: "ORCID" };

    it("renders ORCID login button", () => {
      render(<OAuthLoginForm locale="en-US" provider={orcid} callbackUrl="/platform" />);
      expect(screen.getByText("auth.loginWith-orcid")).toBeInTheDocument();
    });

    it("calls social signIn on click", async () => {
      const user = userEvent.setup();
      render(<OAuthLoginForm locale="en-US" provider={orcid} callbackUrl="/dashboard" />);
      await user.click(screen.getByRole("button"));
      expect(mockSignInSocial).toHaveBeenCalledWith({
        provider: "orcid",
        callbackURL: "http://localhost:3000/dashboard",
        errorCallbackURL: "http://localhost:3000/login-error",
      });
    });

    it("renders ORCID SVG icon with green fill", () => {
      render(<OAuthLoginForm locale="en-US" provider={orcid} callbackUrl="/platform" />);
      expect(document.querySelector('path[fill="#A6CE39"]')).toBeInTheDocument();
    });
  });

  it.each(["github", "orcid"])("returns %s users through registration to Equipment", async (id) => {
    const callbackUrl = "http://localhost:3100/login/openjii?returnTo=%2Fdevices";
    render(<OAuthLoginForm locale="en-US" provider={{ id, name: id }} callbackUrl={callbackUrl} />);
    await userEvent.setup().click(screen.getByRole("button"));
    expect(mockSignInSocial).toHaveBeenCalledWith(
      expect.objectContaining({
        callbackURL: `http://localhost:3000/en-US/register?callbackUrl=${encodeURIComponent(callbackUrl)}`,
      }),
    );
  });

  it.each(["github", "orcid"])("ignores an unapproved %s return address", async (id) => {
    render(
      <OAuthLoginForm
        locale="en-US"
        provider={{ id, name: id }}
        callbackUrl="https://example.com"
      />,
    );
    await userEvent.setup().click(screen.getByRole("button"));
    expect(mockSignInSocial).toHaveBeenCalledWith(
      expect.objectContaining({
        callbackURL: "http://localhost:3000/platform",
      }),
    );
  });

  it("keeps the locale on the sibling registration hop", async () => {
    const callbackUrl = "http://localhost:3100/login/openjii";
    render(
      <OAuthLoginForm
        locale="de-DE"
        provider={{ id: "github", name: "GitHub" }}
        callbackUrl={callbackUrl}
      />,
    );
    await userEvent.setup().click(screen.getByRole("button"));
    expect(mockSignInSocial).toHaveBeenCalledWith(
      expect.objectContaining({
        callbackURL: `http://localhost:3000/de-DE/register?callbackUrl=${encodeURIComponent(callbackUrl)}`,
      }),
    );
  });

  describe("layout variants", () => {
    const github = { id: "github", name: "GitHub" };

    it("shows provider name for layoutCount 2", () => {
      render(
        <OAuthLoginForm locale="en-US" provider={github} callbackUrl="/platform" layoutCount={2} />,
      );
      expect(screen.getByText("Github")).toBeInTheDocument();
    });

    it("renders button for layoutCount 3", () => {
      render(
        <OAuthLoginForm locale="en-US" provider={github} callbackUrl="/platform" layoutCount={3} />,
      );
      expect(screen.getByRole("button")).toBeInTheDocument();
    });

    it("renders default layout when layoutCount not set", () => {
      render(<OAuthLoginForm locale="en-US" provider={github} callbackUrl="/platform" />);
      expect(screen.getByText("auth.loginWith-github")).toBeInTheDocument();
    });
  });

  it("returns null icon for unknown provider", () => {
    render(
      <OAuthLoginForm
        locale="en-US"
        provider={{ id: "unknown", name: "Unknown" }}
        callbackUrl="/platform"
      />,
    );
    expect(screen.getByRole("button")).toBeInTheDocument();
  });
});
