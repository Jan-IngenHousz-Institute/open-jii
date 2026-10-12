import { createSession } from "@/test/factories";
import { render, screen } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { auth } from "~/app/actions/auth";
import { getContentfulClients } from "~/lib/contentful";

import Layout from "./layout";

const mockFooter = vi.fn();

vi.mock("@/components/navigation/unified-navbar/unified-navbar", () => ({
  UnifiedNavbar: () => <nav aria-label="main">navbar</nav>,
}));

vi.mock("@repo/cms", () => ({
  HomeFooter: () => <footer>Footer</footer>,
}));

describe("InfoGroupLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue(null);
    mockFooter.mockResolvedValue({ footerCollection: { items: [{ links: [] }] } });
    vi.mocked(getContentfulClients).mockResolvedValue({
      client: { footer: mockFooter },
      previewClient: { footer: mockFooter },
    } as never);
  });

  const renderLayout = async (session: unknown = null) => {
    vi.mocked(auth).mockResolvedValue(session as never);
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

  it("never reads the session on the server, so the pages under it can be cached", async () => {
    await renderLayout(createSession());
    expect(auth).not.toHaveBeenCalled();
  });

  it("renders children without footer when Contentful throws", async () => {
    mockFooter.mockRejectedValue(new Error("Contentful 500"));
    await renderLayout();
    expect(screen.getByRole("navigation")).toBeInTheDocument();
    expect(screen.getByTestId("child")).toHaveTextContent("Child content");
    expect(screen.queryByRole("contentinfo")).not.toBeInTheDocument();
  });
});
