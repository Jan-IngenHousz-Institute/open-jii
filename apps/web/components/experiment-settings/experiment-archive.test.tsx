import { render, screen } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { ExperimentArchive } from "./experiment-archive";

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

vi.mock("../../hooks/experiment/useExperimentUpdate/useExperimentUpdate", () => ({
  useExperimentUpdate: () => ({ mutateAsync: mockMutateAsync, isPending: false }),
}));

vi.mock("@repo/ui/hooks", () => ({
  toast: (...args: unknown[]) => mockToast(...args),
}));

describe("ExperimentArchive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMutateAsync.mockResolvedValue({ ok: true });
  });

  it("renders archive button when not archived", () => {
    render(<ExperimentArchive experimentId="exp-1" isArchived={false} />);
    expect(screen.getByText("experimentSettings.archiveExperiment")).toBeInTheDocument();
  });

  it("renders unarchive button when archived", () => {
    render(<ExperimentArchive experimentId="exp-1" isArchived={true} />);
    expect(screen.getByText("experimentSettings.unarchiveExperiment")).toBeInTheDocument();
  });

  it("opens dialog and confirms archive", async () => {
    const user = userEvent.setup();
    render(<ExperimentArchive experimentId="exp-1" isArchived={false} />);

    await user.click(screen.getByText("experimentSettings.archiveExperiment"));
    expect(screen.getByText("experimentSettings.archivingExperiment")).toBeInTheDocument();

    await user.click(screen.getByText("experimentSettings.archiveDeactivate"));
    expect(mockMutateAsync).toHaveBeenCalledWith(
      { params: { id: "exp-1" }, body: { status: "archived" } },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );

    // Invoke onSuccess callback
    const call = mockMutateAsync.mock.calls[0] as [unknown, { onSuccess: () => void }];
    call[1].onSuccess();
    expect(mockToast).toHaveBeenCalledWith({
      description: "experimentSettings.experimentArchivedSuccess",
    });
    expect(mockPush).toHaveBeenCalledWith("/en/platform/experiments-archive");
  });

  it("opens dialog and confirms unarchive", async () => {
    const user = userEvent.setup();
    render(<ExperimentArchive experimentId="exp-1" isArchived={true} />);

    await user.click(screen.getByText("experimentSettings.unarchiveExperiment"));
    await user.click(screen.getByText("experimentSettings.unarchiveActivate"));

    const call = mockMutateAsync.mock.calls[0] as [unknown, { onSuccess: () => void }];
    call[1].onSuccess();
    expect(mockPush).toHaveBeenCalledWith("/en/platform/experiments");
  });

  it("shows error toast on failure", async () => {
    const user = userEvent.setup();
    render(<ExperimentArchive experimentId="exp-1" isArchived={false} />);

    await user.click(screen.getByText("experimentSettings.archiveExperiment"));
    await user.click(screen.getByText("experimentSettings.archiveDeactivate"));

    const call = mockMutateAsync.mock.calls[0] as [unknown, { onError: (err: unknown) => void }];
    call[1].onError({ body: { message: "Oops" } });
    expect(mockToast).toHaveBeenCalledWith({ description: "Oops", variant: "destructive" });
  });
});
