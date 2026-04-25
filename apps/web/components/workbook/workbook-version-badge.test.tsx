import { render, screen } from "@/test/test-utils";
import { describe, it, expect } from "vitest";

import { WorkbookVersionBadge } from "./workbook-version-badge";

describe("WorkbookVersionBadge", () => {
  it("renders the current version", () => {
    render(<WorkbookVersionBadge currentVersion={3} />);
    expect(screen.getByText("v3")).toBeInTheDocument();
  });

  it("shows upgrade badge when latestVersion > currentVersion", () => {
    render(<WorkbookVersionBadge currentVersion={2} latestVersion={5} />);
    expect(screen.getByText("v2")).toBeInTheDocument();
    expect(screen.getByText(/v5 available/)).toBeInTheDocument();
  });

  it("hides upgrade badge when showUpgrade is false", () => {
    render(<WorkbookVersionBadge currentVersion={2} latestVersion={5} showUpgrade={false} />);
    expect(screen.getByText("v2")).toBeInTheDocument();
    expect(screen.queryByText(/v5 available/)).not.toBeInTheDocument();
  });

  it("hides upgrade badge when latestVersion equals currentVersion", () => {
    render(<WorkbookVersionBadge currentVersion={3} latestVersion={3} />);
    expect(screen.getByText("v3")).toBeInTheDocument();
    expect(screen.queryByText(/available/)).not.toBeInTheDocument();
  });

  it("hides upgrade badge when latestVersion is not provided", () => {
    render(<WorkbookVersionBadge currentVersion={1} />);
    expect(screen.getByText("v1")).toBeInTheDocument();
    expect(screen.queryByText(/available/)).not.toBeInTheDocument();
  });

  it("hides upgrade badge when latestVersion < currentVersion", () => {
    render(<WorkbookVersionBadge currentVersion={5} latestVersion={3} />);
    expect(screen.getByText("v5")).toBeInTheDocument();
    expect(screen.queryByText(/available/)).not.toBeInTheDocument();
  });
});
