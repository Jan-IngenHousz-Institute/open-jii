import { render, screen } from "@/test/test-utils";
import { redirect } from "next/navigation";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { auth } from "~/app/actions/auth";

import VerifyRequestPage from "./page";

vi.mock("@/components/navigation/unified-navbar/unified-navbar", () => ({
  UnifiedNavbar: () => <nav aria-label="main navigation" />,
}));
vi.mock("~/components/auth/auth-hero-section", () => ({
  AuthHeroSection: () => <section aria-label="auth hero" />,
}));

describe("VerifyRequestPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue(null);
  });

  it("redirects to home when no provider param", async () => {
    await VerifyRequestPage({
      params: Promise.resolve({ locale: "en-US" }),
      searchParams: Promise.resolve({}),
    });
    expect(redirect).toHaveBeenCalledWith("/en-US/");
  });

  it("renders verify-request content when provider is present", async () => {
    const ui = await VerifyRequestPage({
      params: Promise.resolve({ locale: "en-US" }),
      searchParams: Promise.resolve({ provider: "email" }),
    });
    render(ui);
    expect(screen.getByText("auth.verifyRequest")).toBeInTheDocument();
    expect(screen.getByText("auth.verifyRequestDetails")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: /main/i })).toBeInTheDocument();
  });
});
