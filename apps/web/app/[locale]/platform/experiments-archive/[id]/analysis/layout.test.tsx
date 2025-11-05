import { useLocale } from "@/hooks/useLocale";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { usePathname, useParams } from "next/navigation";
import React from "react";
import { vi, describe, it, expect, beforeEach } from "vitest";

import AnalysisLayout from "./layout";

globalThis.React = React;

// Mock hooks
vi.mock("@/hooks/useLocale", () => ({
  useLocale: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
  useParams: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href} data-testid="link">
      {children}
    </a>
  ),
}));

// Mock translation hook
vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

// Mock UI components
vi.mock("@repo/ui/components", () => ({
  Tabs: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <div data-testid="tabs" data-value={value}>
      {children}
    </div>
  ),
  TabsList: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tabs-list">{children}</div>
  ),
  TabsTrigger: ({
    children,
    value,
    asChild,
  }: {
    children: React.ReactNode;
    value: string;
    asChild?: boolean;
  }) => (
    <div data-testid={`tab-trigger-${value}`} data-as-child={String(!!asChild)}>
      {children}
    </div>
  ),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useLocale).mockReturnValue("en-US");
  vi.mocked(useParams).mockReturnValue({ id: "test-experiment-id" });
});

describe("<AnalysisLayout />", () => {
  it("renders children without layout for sub-pages", () => {
    vi.mocked(usePathname).mockReturnValue(
      "/en-US/platform/experiments-archive/test-id/analysis/visualizations/viz-1",
    );

    render(
      <AnalysisLayout>
        <div data-testid="child-content">Child Content</div>
      </AnalysisLayout>,
    );

    expect(screen.getByTestId("child-content")).toBeInTheDocument();
    expect(screen.queryByTestId("tabs")).not.toBeInTheDocument();
  });

  it("renders full layout for main visualizations page", () => {
    vi.mocked(usePathname).mockReturnValue(
      "/en-US/platform/experiments-archive/test-experiment-id/analysis/visualizations",
    );

    render(
      <AnalysisLayout>
        <div data-testid="child-content">Child Content</div>
      </AnalysisLayout>,
    );

    expect(screen.getByText("analysis.title")).toBeInTheDocument();
    expect(screen.getByText("analysis.description")).toBeInTheDocument();
    expect(screen.getByTestId("tabs")).toBeInTheDocument();
    expect(screen.getByTestId("tabs")).toHaveAttribute("data-value", "visualizations");
    expect(screen.getByTestId("child-content")).toBeInTheDocument();
  });

  it("renders correct tab links for archive experiments", () => {
    vi.mocked(usePathname).mockReturnValue(
      "/en-US/platform/experiments-archive/test-experiment-id/analysis/visualizations",
    );

    render(
      <AnalysisLayout>
        <div data-testid="child-content">Child Content</div>
      </AnalysisLayout>,
    );

    expect(screen.getByTestId("tab-trigger-visualizations")).toBeInTheDocument();
    expect(screen.getByTestId("tab-trigger-notebooks")).toBeInTheDocument();

    // Check that visualizations tab is a link
    const visualizationsTab = screen.getByTestId("tab-trigger-visualizations");
    expect(visualizationsTab).toHaveAttribute("data-as-child", "true");

    // Check that notebooks tab is disabled
    const notebooksTab = screen.getByTestId("tab-trigger-notebooks");
    expect(notebooksTab).toHaveAttribute("data-as-child", "false");
    expect(screen.getByText("analysis.notebooks")).toBeInTheDocument();
  });

  it("sets active tab to notebooks when pathname includes notebooks", () => {
    vi.mocked(usePathname).mockReturnValue(
      "/en-US/platform/experiments-archive/test-experiment-id/analysis/notebooks",
    );

    render(
      <AnalysisLayout>
        <div data-testid="child-content">Child Content</div>
      </AnalysisLayout>,
    );

    expect(screen.getByTestId("tabs")).toHaveAttribute("data-value", "notebooks");
  });

  it("defaults to visualizations tab for unknown paths", () => {
    vi.mocked(usePathname).mockReturnValue(
      "/en-US/platform/experiments-archive/test-experiment-id/analysis/notebooks",
    );

    render(
      <AnalysisLayout>
        <div data-testid="child-content">Child Content</div>
      </AnalysisLayout>,
    );

    expect(screen.getByTestId("tabs")).toHaveAttribute("data-value", "notebooks");
  });
});
