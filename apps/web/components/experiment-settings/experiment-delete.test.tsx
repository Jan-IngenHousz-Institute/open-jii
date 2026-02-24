import { server } from "@/test/msw/server";
import { render, screen, waitFor } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import { useFeatureFlagEnabled } from "posthog-js/react";
import { describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api";
import { toast } from "@repo/ui/hooks";

import { ExperimentDelete } from "./experiment-delete";

describe("ExperimentDelete", () => {
  it("does not render when feature flag is disabled", () => {
    vi.mocked(useFeatureFlagEnabled).mockReturnValue(false);
    const { container } = render(<ExperimentDelete experimentId="exp-1" experimentName="Test" />);
    expect(container.firstChild).toBeNull();
  });

  it("renders delete button when flag is enabled", () => {
    vi.mocked(useFeatureFlagEnabled).mockReturnValue(true);
    render(<ExperimentDelete experimentId="exp-1" experimentName="Test" />);
    expect(screen.getByText("experimentSettings.deleteExperiment")).toBeInTheDocument();
  });

  it("opens dialog, confirms delete, redirects on success", async () => {
    vi.mocked(useFeatureFlagEnabled).mockReturnValue(true);
    const spy = server.mount(contract.experiments.deleteExperiment);
    const user = userEvent.setup();

    const { router } = render(<ExperimentDelete experimentId="exp-1" experimentName="Test" />);

    await user.click(screen.getByText("experimentSettings.deleteExperiment"));
    await user.click(screen.getByText("experimentSettings.delete"));

    await waitFor(() => expect(spy.called).toBe(true));
    expect(spy.params).toMatchObject({ id: "exp-1" });

    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith({
        description: "experimentSettings.experimentDeletedSuccess",
      });
    });
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(router.push).toHaveBeenCalledWith("/en-US/platform/experiments");
  });

  it("shows error toast on failure", async () => {
    vi.mocked(useFeatureFlagEnabled).mockReturnValue(true);
    server.mount(contract.experiments.deleteExperiment, {
      status: 500,
      body: { message: "Nope" },
    });
    const user = userEvent.setup();

    render(<ExperimentDelete experimentId="exp-1" experimentName="Test" />);

    await user.click(screen.getByText("experimentSettings.deleteExperiment"));
    await user.click(screen.getByText("experimentSettings.delete"));

    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" }));
    });
  });
});
