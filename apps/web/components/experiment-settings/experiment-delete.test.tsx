import { render, screen } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import { useFeatureFlagEnabled } from "posthog-js/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { ExperimentDelete } from "./experiment-delete";

const mockPush = vi.fn();
const mockMutateAsync = vi.fn().mockResolvedValue({ ok: true });
const mockToast = vi.fn();

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/hooks/useLocale", () => ({
  useLocale: () => "en",
}));

vi.mock("../../hooks/experiment/useExperimentDelete/useExperimentDelete", () => ({
  useExperimentDelete: () => ({ mutateAsync: mockMutateAsync, isPending: false }),
}));

vi.mock("@repo/ui/hooks", () => ({
  toast: (...args: unknown[]) => mockToast(...args),
}));

describe("ExperimentDelete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMutateAsync.mockResolvedValue({ ok: true });
  });

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
    const user = userEvent.setup();

    render(<ExperimentDelete experimentId="exp-1" experimentName="Test" />);

    await user.click(screen.getByText("experimentSettings.deleteExperiment"));
    await user.click(screen.getByText("experimentSettings.delete"));

    expect(mockMutateAsync).toHaveBeenCalledWith(
      { params: { id: "exp-1" } },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );

    const call = mockMutateAsync.mock.calls[0] as [unknown, { onSuccess: () => void }];
    call[1].onSuccess();
    expect(mockToast).toHaveBeenCalledWith({
      description: "experimentSettings.experimentDeletedSuccess",
    });
    expect(mockPush).toHaveBeenCalledWith("/en/platform/experiments");
  });

  it("shows error toast on failure", async () => {
    vi.mocked(useFeatureFlagEnabled).mockReturnValue(true);
    const user = userEvent.setup();

    render(<ExperimentDelete experimentId="exp-1" experimentName="Test" />);

    await user.click(screen.getByText("experimentSettings.deleteExperiment"));
    await user.click(screen.getByText("experimentSettings.delete"));

    const call = mockMutateAsync.mock.calls[0] as [unknown, { onError: (err: unknown) => void }];
    call[1].onError({ body: { message: "Nope" } });
    expect(mockToast).toHaveBeenCalledWith({ description: "Nope", variant: "destructive" });
  });
});
