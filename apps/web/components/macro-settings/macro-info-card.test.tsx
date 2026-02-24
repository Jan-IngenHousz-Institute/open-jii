import { render, screen } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import { useFeatureFlagEnabled } from "posthog-js/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { MacroInfoCard } from "./macro-info-card";

const mockPush = vi.fn();
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal()),
  useRouter: () => ({ push: mockPush }),
}));

const mockDeleteMacro = vi.fn();
vi.mock("@/hooks/macro/useMacroDelete/useMacroDelete", () => ({
  useMacroDelete: () => ({ mutateAsync: mockDeleteMacro, isPending: false }),
}));

const macro = {
  id: "macro-1",
  name: "Test Macro",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-06-01T00:00:00Z",
};

describe("MacroInfoCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders macro info", () => {
    render(<MacroInfoCard macroId="macro-1" macro={macro as never} />);

    expect(screen.getByText("macroSettings.macroInfo")).toBeInTheDocument();
    expect(screen.getByText("macro-1")).toBeInTheDocument();
  });

  it("hides danger zone when feature flag is off", () => {
    render(<MacroInfoCard macroId="macro-1" macro={macro as never} />);

    expect(screen.queryByText("macroSettings.dangerZone")).not.toBeInTheDocument();
  });

  it("shows danger zone when feature flag is on", () => {
    vi.mocked(useFeatureFlagEnabled).mockReturnValue(true);
    render(<MacroInfoCard macroId="macro-1" macro={macro as never} />);

    expect(screen.getByText("macroSettings.dangerZone")).toBeInTheDocument();
    expect(screen.getByText("macroSettings.deleteMacro")).toBeInTheDocument();
  });

  it("opens delete dialog and deletes macro", async () => {
    vi.mocked(useFeatureFlagEnabled).mockReturnValue(true);
    mockDeleteMacro.mockResolvedValue({});
    const user = userEvent.setup();

    render(<MacroInfoCard macroId="macro-1" macro={macro as never} />);

    await user.click(screen.getByText("macroSettings.deleteMacro"));
    await user.click(screen.getByText("macroSettings.delete"));

    expect(mockDeleteMacro).toHaveBeenCalledWith({ params: { id: "macro-1" } });
    expect(mockPush).toHaveBeenCalledWith("/en-US/platform/macros");
  });
});
