import { useBreadcrumbs } from "@/hooks/breadcrumbs/useBreadcrumbs";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { Breadcrumbs } from "./navigation-breadcrumbs";

// Mock useBreadcrumbs hook
vi.mock("@/hooks/breadcrumbs/useBreadcrumbs", () => ({
  useBreadcrumbs: vi.fn(),
}));

const mockUseBreadcrumbs = vi.mocked(useBreadcrumbs);

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
}));

// Mock @repo/i18n
vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock @repo/ui/components
vi.mock("@repo/ui/components", () => ({
  Breadcrumb: ({ children }: { children: React.ReactNode }) => <nav>{children}</nav>,
  BreadcrumbList: ({ children }: { children: React.ReactNode }) => <ol>{children}</ol>,
  BreadcrumbItem: ({ children }: { children: React.ReactNode }) => <li>{children}</li>,
  BreadcrumbLink: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
  BreadcrumbSeparator: () => <span>/</span>,
}));

describe("Breadcrumbs", () => {
  let queryClient: QueryClient;

  const renderWithQueryClient = (component: React.ReactElement) => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    return render(<QueryClientProvider client={queryClient}>{component}</QueryClientProvider>);
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing on platform root and first-level routes", () => {
    mockUseBreadcrumbs.mockReturnValue({
      data: [],
    } as unknown as ReturnType<typeof useBreadcrumbs>);

    const { container } = renderWithQueryClient(<Breadcrumbs locale="en" />);

    expect(container.firstChild).toBeNull();
  });

  it("renders breadcrumb trail for nested path", () => {
    mockUseBreadcrumbs.mockReturnValue({
      data: [
        { segment: "experiments", title: "experiments", href: "/en/platform/experiments" },
        { segment: "new", title: "new", href: "/en/platform/experiments/new" },
      ],
    } as unknown as ReturnType<typeof useBreadcrumbs>);

    renderWithQueryClient(<Breadcrumbs locale="en" />);

    // Component translates the segments using getTranslatedTitle
    expect(screen.getByText("breadcrumbs.experiments")).toBeInTheDocument();
    expect(screen.getByText("breadcrumbs.new")).toBeInTheDocument();
  });

  it("displays name for UUID segments", () => {
    mockUseBreadcrumbs.mockReturnValue({
      data: [
        { segment: "experiments", title: "experiments", href: "/en/platform/experiments" },
        {
          segment: "a1b2c3d4-e5f6-4890-abcd-ef1234567890",
          title: "My Experiment",
          href: "/en/platform/experiments/a1b2c3d4-e5f6-4890-abcd-ef1234567890",
        },
      ],
    } as ReturnType<typeof useBreadcrumbs>);

    renderWithQueryClient(<Breadcrumbs locale="en" />);

    expect(screen.getByText("breadcrumbs.experiments")).toBeInTheDocument();
    expect(screen.getByText("My Experiment")).toBeInTheDocument();
  });

  it("capitalizes unknown path segments", () => {
    mockUseBreadcrumbs.mockReturnValue({
      data: [
        { segment: "experiments", title: "experiments", href: "/en/platform/experiments" },
        {
          segment: "unknown-route",
          title: "Unknown Route",
          href: "/en/platform/experiments/unknown-route",
        },
      ],
    } as ReturnType<typeof useBreadcrumbs>);

    renderWithQueryClient(<Breadcrumbs locale="en" />);

    expect(screen.getByText("breadcrumbs.experiments")).toBeInTheDocument();
    expect(screen.getByText("Unknown Route")).toBeInTheDocument();
  });

  it("generates correct href for each breadcrumb level", () => {
    mockUseBreadcrumbs.mockReturnValue({
      data: [
        { segment: "experiments", title: "experiments", href: "/en/platform/experiments" },
        {
          segment: "a1b2c3d4-e5f6-4890-abcd-ef1234567890",
          title: "My Experiment",
          href: "/en/platform/experiments/a1b2c3d4-e5f6-4890-abcd-ef1234567890",
        },
      ],
    } as ReturnType<typeof useBreadcrumbs>);

    renderWithQueryClient(<Breadcrumbs locale="en" />);

    const links = screen.getAllByRole("link");
    expect(links[0]).toHaveAttribute("href", "/en/platform/experiments");
    expect(links[1]).toHaveAttribute(
      "href",
      "/en/platform/experiments/a1b2c3d4-e5f6-4890-abcd-ef1234567890",
    );
  });

  it("handles different locales correctly", () => {
    mockUseBreadcrumbs.mockReturnValue({
      data: [
        { segment: "experiments", title: "experiments", href: "/de/platform/experiments" },
        { segment: "new", title: "new", href: "/de/platform/experiments/new" },
      ],
    } as ReturnType<typeof useBreadcrumbs>);

    renderWithQueryClient(<Breadcrumbs locale="de" />);

    const experimentsLink = screen.getByText("breadcrumbs.experiments").closest("a");
    expect(experimentsLink).toHaveAttribute("href", "/de/platform/experiments");
  });

  it("renders separators between breadcrumb items", () => {
    mockUseBreadcrumbs.mockReturnValue({
      data: [
        { segment: "experiments", title: "experiments", href: "/en/platform/experiments" },
        { segment: "new", title: "new", href: "/en/platform/experiments/new" },
      ],
    } as ReturnType<typeof useBreadcrumbs>);

    const { container } = renderWithQueryClient(<Breadcrumbs locale="en" />);

    const separators = container.querySelectorAll("span");
    // Should have 1 separator (between Experiments->New)
    expect(separators.length).toBe(1);
  });

  it("updates when pathname changes", () => {
    mockUseBreadcrumbs.mockReturnValue({
      data: [
        { segment: "experiments", title: "experiments", href: "/en/platform/experiments" },
        { segment: "new", title: "new", href: "/en/platform/experiments/new" },
      ],
    } as ReturnType<typeof useBreadcrumbs>);

    const { rerender } = renderWithQueryClient(<Breadcrumbs locale="en" />);

    expect(screen.getByText("breadcrumbs.experiments")).toBeInTheDocument();

    // Simulate navigation
    mockUseBreadcrumbs.mockReturnValue({
      data: [
        { segment: "protocols", title: "protocols", href: "/en/platform/protocols" },
        { segment: "new", title: "new", href: "/en/platform/protocols/new" },
      ],
    } as ReturnType<typeof useBreadcrumbs>);
    rerender(
      <QueryClientProvider client={queryClient}>
        <Breadcrumbs locale="en" />
      </QueryClientProvider>,
    );

    expect(screen.getByText("breadcrumbs.protocols")).toBeInTheDocument();
    expect(screen.queryByText("breadcrumbs.experiments")).not.toBeInTheDocument();
  });

  it("handles missing translationKey by returning capitalized segment", () => {
    mockUseBreadcrumbs.mockReturnValue({
      data: [
        { segment: "experiments", title: "experiments", href: "/en/platform/experiments" },
        {
          segment: "custom-page",
          title: "Custom Page",
          href: "/en/platform/experiments/custom-page",
        },
      ],
    } as ReturnType<typeof useBreadcrumbs>);

    renderWithQueryClient(<Breadcrumbs locale="en" />);

    expect(screen.getByText("Custom Page")).toBeInTheDocument();
  });
});
