import { createMacro } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { useFeatureFlagEnabled } from "posthog-js/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { contract } from "@repo/api";

import { MacroInfoCard } from "./macro-info-card";

const macro = createMacro({
  id: "macro-1",
  name: "Test Macro",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-06-01T00:00:00Z",
});

describe("MacroInfoCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders macro info", () => {
    render(<MacroInfoCard macroId="macro-1" macro={macro} />);

    expect(screen.getByText("macroSettings.macroInfo")).toBeInTheDocument();
    expect(screen.getByText("macro-1")).toBeInTheDocument();
  });

  it("hides danger zone when feature flag is off", () => {
    render(<MacroInfoCard macroId="macro-1" macro={macro} />);

    expect(screen.queryByText("macroSettings.dangerZone")).not.toBeInTheDocument();
  });

  it("shows danger zone when feature flag is on", () => {
    vi.mocked(useFeatureFlagEnabled).mockReturnValue(true);
    render(<MacroInfoCard macroId="macro-1" macro={macro} />);

    expect(screen.getByText("macroSettings.dangerZone")).toBeInTheDocument();
    expect(screen.getByText("macroSettings.deleteMacro")).toBeInTheDocument();
  });

  it("opens delete dialog and deletes macro", async () => {
    vi.mocked(useFeatureFlagEnabled).mockReturnValue(true);
    const spy = server.mount(contract.macros.deleteMacro);
    const user = userEvent.setup();

    const { router } = render(<MacroInfoCard macroId="macro-1" macro={macro} />);

    await user.click(screen.getByText("macroSettings.deleteMacro"));
    await user.click(screen.getByText("macroSettings.delete"));

    await waitFor(() => {
      expect(spy.called).toBe(true);
    });
    expect(spy.params).toMatchObject({ id: "macro-1" });
    expect(router.push).toHaveBeenCalledWith("/en-US/platform/macros");
  });
});
