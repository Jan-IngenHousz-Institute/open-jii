import { render, screen, userEvent } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { authClient } from "@repo/auth/client";

import { OAuthLoginForm } from "./oauth-login-form";

vi.mock("@repo/auth/client", () => ({
  authClient: {
    signIn: { oauth2: vi.fn(), social: vi.fn() },
  },
}));

const mockSignInSocial = authClient.signIn.social as ReturnType<typeof vi.fn>;
const mockSignInOAuth2 = authClient.signIn.oauth2 as ReturnType<typeof vi.fn>;

describe("OAuthLoginForm", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("GitHub (social)", () => {
    const github = { id: "github", name: "GitHub" };

    it("renders login button with translation key", () => {
      render(<OAuthLoginForm provider={github} callbackUrl="/platform" />);
      expect(screen.getByText("auth.loginWith-github")).toBeInTheDocument();
    });

    it("calls social signIn on click", async () => {
      const user = userEvent.setup();
      render(<OAuthLoginForm provider={github} callbackUrl="/dashboard" />);
      await user.click(screen.getByRole("button"));
      expect(mockSignInSocial).toHaveBeenCalledWith({
        provider: "github",
        callbackURL: "http://localhost:3000/dashboard",
        errorCallbackURL: "http://localhost:3000/login-error",
      });
    });

    it("uses default callback URL when not provided", async () => {
      const user = userEvent.setup();
      render(<OAuthLoginForm provider={github} callbackUrl={undefined} />);
      await user.click(screen.getByRole("button"));
      expect(mockSignInSocial).toHaveBeenCalledWith(
        expect.objectContaining({ callbackURL: "http://localhost:3000/platform" }),
      );
    });

    it("renders GitHub SVG icon", () => {
      const { container } = render(<OAuthLoginForm provider={github} callbackUrl="/platform" />);
      expect(container.querySelector('svg[viewBox="0 0 24 24"]')).toBeInTheDocument();
    });
  });

  describe("ORCID (oauth2)", () => {
    const orcid = { id: "orcid", name: "ORCID" };

    it("renders ORCID login button", () => {
      render(<OAuthLoginForm provider={orcid} callbackUrl="/platform" />);
      expect(screen.getByText("auth.loginWith-orcid")).toBeInTheDocument();
    });

    it("calls oauth2 signIn on click", async () => {
      const user = userEvent.setup();
      render(<OAuthLoginForm provider={orcid} callbackUrl="/dashboard" />);
      await user.click(screen.getByRole("button"));
      expect(mockSignInOAuth2).toHaveBeenCalledWith({
        providerId: "orcid",
        callbackURL: "http://localhost:3000/dashboard",
        errorCallbackURL: "http://localhost:3000/login-error",
      });
    });

    it("renders ORCID SVG icon with green fill", () => {
      const { container } = render(<OAuthLoginForm provider={orcid} callbackUrl="/platform" />);
      expect(container.querySelector('path[fill="#A6CE39"]')).toBeInTheDocument();
    });
  });

  describe("layout variants", () => {
    const github = { id: "github", name: "GitHub" };

    it("shows provider name for layoutCount 2", () => {
      render(<OAuthLoginForm provider={github} callbackUrl="/platform" layoutCount={2} />);
      expect(screen.getByText("Github")).toBeInTheDocument();
    });

    it("renders button for layoutCount 3", () => {
      render(<OAuthLoginForm provider={github} callbackUrl="/platform" layoutCount={3} />);
      expect(screen.getByRole("button")).toBeInTheDocument();
    });

    it("renders default layout when layoutCount not set", () => {
      render(<OAuthLoginForm provider={github} callbackUrl="/platform" />);
      expect(screen.getByText("auth.loginWith-github")).toBeInTheDocument();
    });
  });

  it("returns null icon for unknown provider", () => {
    render(
      <OAuthLoginForm provider={{ id: "unknown", name: "Unknown" }} callbackUrl="/platform" />,
    );
    expect(screen.getByRole("button")).toBeInTheDocument();
  });
});
