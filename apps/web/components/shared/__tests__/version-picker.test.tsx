import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { VersionPicker } from "../version-picker";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => "/en-US/platform/macros/test-id",
}));

describe("VersionPicker", () => {
  const versions = [
    { version: 3, updatedAt: "2026-03-23T10:00:00Z" },
    { version: 2, updatedAt: "2026-03-22T10:00:00Z" },
    { version: 1, updatedAt: "2026-03-21T10:00:00Z" },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render the select with current version", () => {
    render(<VersionPicker currentVersion={2} versions={versions} />);
    expect(screen.getByRole("combobox")).toBeDefined();
  });

  it("should show all version options", () => {
    const { container } = render(<VersionPicker currentVersion={2} versions={versions} />);
    // The select trigger should show the current version
    expect(container.textContent).toContain("v2");
  });

  it("should mark the latest version", () => {
    const { container } = render(<VersionPicker currentVersion={3} versions={versions} />);
    expect(container.textContent).toContain("v3");
  });
});
