import { render, screen } from "@/test/test-utils";
import { notFound } from "next/navigation";
import { describe, it, expect, vi, beforeEach } from "vitest";

import LoginErrorPage from "./page";

const mockAuth = vi.fn();
vi.mock("~/app/actions/auth", () => ({ auth: mockAuth, providerMap: [] }));

vi.mock("@/components/navigation/unified-navbar/unified-navbar", () => ({
  UnifiedNavbar: () => <nav aria-label="main navigation" />,
}));
vi.mock("~/components/auth/auth-hero-section", () => ({
  AuthHeroSection: () => <section aria-label="auth hero" />,
}));
vi.mock("~/components/auth/error-content", () => ({
  ErrorContent: ({ error }: { error?: string }) => (
    <section aria-label="error content">{error}</section>
  ),
}));

describe("LoginErrorPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue(null);
  });

  const renderPage = async (searchParams: Record<string, string> = { error: "OAuthError" }) => {
    const ui = await LoginErrorPage({
      params: Promise.resolve({ locale: "en-US" }),
      searchParams: Promise.resolve(searchParams),
    });
    return render(ui);
  };

  it("calls notFound when no error param is present", async () => {
    await LoginErrorPage({
      params: Promise.resolve({ locale: "en-US" }),
      searchParams: Promise.resolve({}),
    });
    expect(notFound).toHaveBeenCalled();
  });

  it("renders error content when error param is present", async () => {
    await renderPage({ error: "AccessDenied" });
    expect(screen.getByRole("region", { name: /error content/i })).toHaveTextContent(
      "AccessDenied",
    );
    expect(screen.getByRole("navigation", { name: /main/i })).toBeInTheDocument();
    expect(screen.getByAltText(/error background/i)).toBeInTheDocument();
  });

  it("renders when error param is an empty string", async () => {
    await renderPage({ error: "" });
    expect(screen.getByRole("region", { name: /error content/i })).toBeInTheDocument();
  });
});
