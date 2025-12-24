import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import { ExperimentStatusBadge } from "./ExperimentStatusBadge";

// Mock the useTranslation hook
vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock UI components
vi.mock("@repo/ui/components", () => ({
  Badge: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <span data-testid="badge" className={className}>
      {children}
    </span>
  ),
}));

describe("ExperimentStatusBadge", () => {
  it("renders active status", () => {
    render(<ExperimentStatusBadge status="active" />);
    expect(screen.getByTestId("badge")).toHaveTextContent("status.active");
  });

  it("renders provisioning status", () => {
    render(<ExperimentStatusBadge status="provisioning" />);
    expect(screen.getByTestId("badge")).toHaveTextContent("status.provisioning");
  });

  it("renders archived status", () => {
    render(<ExperimentStatusBadge status="archived" />);
    expect(screen.getByTestId("badge")).toHaveTextContent("status.archived");
  });

  it("renders stale status", () => {
    render(<ExperimentStatusBadge status="stale" />);
    expect(screen.getByTestId("badge")).toHaveTextContent("status.stale");
  });

  it("renders provisioning_failed status", () => {
    render(<ExperimentStatusBadge status="provisioning_failed" />);
    expect(screen.getByTestId("badge")).toHaveTextContent("status.provisioningFailed");
  });

  it("renders unknown status with fallback", () => {
    render(<ExperimentStatusBadge status="unknown" />);
    expect(screen.getByTestId("badge")).toHaveTextContent("unknown");
  });
});
