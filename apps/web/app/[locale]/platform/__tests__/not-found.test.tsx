import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";

import PlatformNotFound from "../not-found";

// Mock usePathname from next/navigation
const mockUsePathname = vi.fn<() => string>();
vi.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
}));

// Mock next/link
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    className,
  }: {
    children: React.ReactNode;
    href: string;
    className?: string;
  }) => (
    <a href={href} className={className} data-testid="link">
      {children}
    </a>
  ),
}));

describe("PlatformNotFound", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePathname.mockReturnValue("/en-US/platform/some-page");
  });

  describe("Rendering", () => {
    it("should render 404 display", () => {
      render(<PlatformNotFound />);

      expect(screen.getByText("404")).toBeInTheDocument();
    });

    it("should render error messages", () => {
      render(<PlatformNotFound />);

      expect(screen.getByText("errors.notFound")).toBeInTheDocument();
      expect(screen.getByText("errors.resourceNotFoundMessage")).toBeInTheDocument();
    });

    it("should render home button with link to platform", () => {
      render(<PlatformNotFound />);

      const links = screen.getAllByTestId("link");
      const homeLink = links.find((link) => link.getAttribute("href") === "/platform");

      expect(homeLink).toBeInTheDocument();
      expect(screen.getByText("errors.backToDashboard")).toBeInTheDocument();
    });
  });

  describe("Secondary Navigation - Protocols", () => {
    it("should show protocols navigation when pathname includes /protocols", () => {
      mockUsePathname.mockReturnValue("/en-US/platform/protocols/invalid-id");

      render(<PlatformNotFound />);

      const links = screen.getAllByTestId("link");
      const protocolsLink = links.find(
        (link) => link.getAttribute("href") === "/platform/protocols",
      );

      expect(protocolsLink).toBeInTheDocument();
      expect(screen.getByText("sidebar.protocols")).toBeInTheDocument();
    });
  });

  describe("Secondary Navigation - Macros", () => {
    it("should show macros navigation when pathname includes /macros", () => {
      mockUsePathname.mockReturnValue("/en-US/platform/macros/invalid-id");

      render(<PlatformNotFound />);

      const links = screen.getAllByTestId("link");
      const macrosLink = links.find((link) => link.getAttribute("href") === "/platform/macros");

      expect(macrosLink).toBeInTheDocument();
      expect(screen.getByText("sidebar.macros")).toBeInTheDocument();
    });
  });

  describe("Secondary Navigation - Experiments (default)", () => {
    it("should show experiments navigation by default", () => {
      mockUsePathname.mockReturnValue("/en-US/platform/some-unknown-path");

      render(<PlatformNotFound />);

      const links = screen.getAllByTestId("link");
      const experimentsLink = links.find(
        (link) => link.getAttribute("href") === "/platform/experiments",
      );

      expect(experimentsLink).toBeInTheDocument();
      expect(screen.getByText("sidebar.experiments")).toBeInTheDocument();
    });

    it("should show experiments navigation when no specific section matches", () => {
      mockUsePathname.mockReturnValue("/en-US/platform/experiments/invalid-id");

      render(<PlatformNotFound />);

      const links = screen.getAllByTestId("link");
      const experimentsLink = links.find(
        (link) => link.getAttribute("href") === "/platform/experiments",
      );

      expect(experimentsLink).toBeInTheDocument();
    });
  });
});
