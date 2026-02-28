import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { ExperimentStatusBadge } from "./ExperimentStatusBadge";

describe("ExperimentStatusBadge", () => {
  it("renders active status", () => {
    render(<ExperimentStatusBadge status="active" />);
    expect(screen.getByText("status.active")).toBeInTheDocument();
  });

  it("renders archived status", () => {
    render(<ExperimentStatusBadge status="archived" />);
    expect(screen.getByText("status.archived")).toBeInTheDocument();
  });

  it("renders stale status", () => {
    render(<ExperimentStatusBadge status="stale" />);
    expect(screen.getByText("status.stale")).toBeInTheDocument();
  });

  it("renders unknown status as fallback text", () => {
    render(<ExperimentStatusBadge status="unknown" />);
    expect(screen.getByText("unknown")).toBeInTheDocument();
  });
});
