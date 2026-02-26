import { render, screen, userEvent } from "@/test/test-utils";
import { useFeatureFlagEnabled } from "posthog-js/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { LanguageSwitcher } from "./language-switcher";

describe("LanguageSwitcher", () => {
  beforeEach(() => {
    vi.mocked(useFeatureFlagEnabled).mockReturnValue(false);
  });

  it("returns null when feature flag is disabled", () => {
    const { container } = render(<LanguageSwitcher locale="en-US" />);
    expect(container.firstChild).toBeNull();
  });

  it("returns null when feature flag is loading (undefined)", () => {
    vi.mocked(useFeatureFlagEnabled).mockReturnValue(undefined as unknown as boolean);
    const { container } = render(<LanguageSwitcher locale="en-US" />);
    expect(container.firstChild).toBeNull();
  });

  it("renders trigger button when flag is enabled", () => {
    vi.mocked(useFeatureFlagEnabled).mockReturnValue(true);
    render(<LanguageSwitcher locale="en-US" />);

    expect(screen.getByLabelText("Switch language")).toBeInTheDocument();
  });

  it("shows locales after opening the dropdown", async () => {
    vi.mocked(useFeatureFlagEnabled).mockReturnValue(true);
    const user = userEvent.setup();
    render(<LanguageSwitcher locale="en-US" />);

    await user.click(screen.getByLabelText("Switch language"));

    expect(screen.getByText("English")).toBeInTheDocument();
    expect(screen.getByText("Deutsch")).toBeInTheDocument();
  });

  it("uses icon size for header variant", () => {
    vi.mocked(useFeatureFlagEnabled).mockReturnValue(true);
    render(<LanguageSwitcher locale="en-US" variant="header" />);

    expect(screen.getByLabelText("Switch language")).toBeInTheDocument();
  });
});
