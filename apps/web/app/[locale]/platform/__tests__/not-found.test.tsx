import { render, screen } from "@/test/test-utils";
import { usePathname } from "next/navigation";
import { describe, it, expect, beforeEach, vi } from "vitest";

import PlatformNotFound from "../not-found";

describe("PlatformNotFound", () => {
  beforeEach(() => {
    vi.mocked(usePathname).mockReturnValue("/en-US/platform/some-page");
  });

  it("should render 404 display with error messages", () => {
    render(<PlatformNotFound />);

    expect(screen.getByText("404")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "errors.notFound" })).toBeInTheDocument();
    expect(screen.getByText("errors.resourceNotFoundMessage")).toBeInTheDocument();
  });

  it("should render dashboard link", () => {
    render(<PlatformNotFound />);

    expect(screen.getByRole("link", { name: /errors.backToDashboard/ })).toHaveAttribute(
      "href",
      "/platform",
    );
  });

  it("should show protocols navigation when pathname includes /protocols", () => {
    vi.mocked(usePathname).mockReturnValue("/en-US/platform/protocols/invalid-id");

    render(<PlatformNotFound />);

    expect(screen.getByRole("link", { name: /sidebar.protocols/ })).toHaveAttribute(
      "href",
      "/platform/protocols",
    );
  });

  it("should show macros navigation when pathname includes /macros", () => {
    vi.mocked(usePathname).mockReturnValue("/en-US/platform/macros/invalid-id");

    render(<PlatformNotFound />);

    expect(screen.getByRole("link", { name: /sidebar.macros/ })).toHaveAttribute(
      "href",
      "/platform/macros",
    );
  });

  it("should show experiments navigation by default", () => {
    vi.mocked(usePathname).mockReturnValue("/en-US/platform/some-unknown-path");

    render(<PlatformNotFound />);

    expect(screen.getByRole("link", { name: /sidebar.experiments/ })).toHaveAttribute(
      "href",
      "/platform/experiments",
    );
  });
});
