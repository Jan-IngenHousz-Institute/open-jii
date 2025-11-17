import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import ProtocolCodeEditor from "../protocol-code-editor";

// Mock posthog feature flag hook
vi.mock("posthog-js/react", () => ({
  useFeatureFlagEnabled: vi.fn(),
}));

// Mock useDebounce to return value immediately for testing
vi.mock("~/hooks/useDebounce", () => ({
  useDebounce: (value: string) => [value, false],
}));

describe("ProtocolCodeEditor", () => {
  const mockOnChange = vi.fn();
  const mockOnValidationChange = vi.fn();
  const defaultProps = {
    value: [{ averages: 1, environmental: [["light_intensity", 0]] }],
    onChange: mockOnChange,
    onValidationChange: mockOnValidationChange,
    label: "Protocol Code",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render the editor with label", () => {
    render(<ProtocolCodeEditor {...defaultProps} />);

    expect(screen.getByText("Protocol Code")).toBeInTheDocument();
  });

  it("should display JSON stats", () => {
    render(<ProtocolCodeEditor {...defaultProps} />);

    // Stats should be displayed somewhere (lines and size)
    expect(screen.getByText(/lines/i)).toBeTruthy();
  });

  it("should display error message when provided", () => {
    render(<ProtocolCodeEditor {...defaultProps} error="Something went wrong" />);

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it.skip("should handle Monaco editor interactions", () => {
    // Skipped: Monaco Editor is a complex third-party component that requires
    // sophisticated mocking or integration testing. Testing editor interactions
    // (typing, validation, clipboard operations) would require either:
    // 1. Complex mocks that duplicate component logic
    // 2. Full integration tests with Monaco loaded
    // 3. E2E tests with a real browser environment
    // 
    // Current coverage focuses on:
    // - Component rendering and props handling
    // - Display of labels, stats, and error messages
    // - Overall component structure
    //
    // Editor-specific functionality (JSON parsing, validation, syntax highlighting)
    // is better suited for integration or E2E tests.
  });
});
