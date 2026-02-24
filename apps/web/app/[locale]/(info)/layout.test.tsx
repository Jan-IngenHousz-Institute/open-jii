import { createSession } from "@/test/factories";
import { render, screen } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAuth = vi.fn();
vi.mock("~/app/actions/auth", () => ({ auth: () => mockAuth() }));

const mockFooter = vi.fn();
vi.mock("~/lib/contentful", () => ({
  getContentfulClients: vi.fn().mockResolvedValue({
    client: { footer: (...a: unknown[]) => mockFooter(...a) },
    previewClient: { footer: (...a: unknown[]) => mockFooter(...a) },
  }),
}));

vi.mock("@/components/navigation/unified-navbar/unified-navbar", () => ({
  UnifiedNavbar: ({ session }: { session: unknown }) => (
    <nav aria-label="main">{session ? "logged-in" : "guest"}</nav>
  ),
}));

vi.mock("@repo/cms", () => ({
  HomeFooter: () => <footer>Footer</footer>,
}));

describe("InfoGroupLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue(null);
    mockFooter.mockResolvedValue({ footerCollection: { items: [{ links: [] }] } });
  });

  const renderLayout = async (session: unknown = null) => {
    mockAuth.mockResolvedValue(session);
    const { default: Layout } = await import("./layout");
    const ui = await Layout({
      children: <div data-testid="child">Child content</div>,
      params: Promise.resolve({ locale: "en-US" }),
    });
    return render(ui);
  };

  it("renders children within navbar and footer", async () => {
    await renderLayout();
    expect(screen.getByRole("navigation")).toBeInTheDocument();
    expect(screen.getByTestId("child")).toHaveTextContent("Child content");
    expect(screen.getByRole("contentinfo")).toHaveTextContent("Footer");
  });

  it("shows guest state when unauthenticated", async () => {
    await renderLayout();
    expect(screen.getByRole("navigation")).toHaveTextContent("guest");
  });

  it("passes session to navbar when authenticated", async () => {
    await renderLayout(createSession());
    expect(screen.getByRole("navigation")).toHaveTextContent("logged-in");
  });
});
