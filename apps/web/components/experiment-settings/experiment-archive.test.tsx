import { createExperiment } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, waitFor } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api";
import { toast } from "@repo/ui/hooks";

import { ExperimentArchive } from "./experiment-archive";

describe("ExperimentArchive", () => {
  it("renders archive button when not archived", () => {
    render(<ExperimentArchive experimentId="exp-1" isArchived={false} />);
    expect(screen.getByText("experimentSettings.archiveExperiment")).toBeInTheDocument();
  });

  it("renders unarchive button when archived", () => {
    render(<ExperimentArchive experimentId="exp-1" isArchived={true} />);
    expect(screen.getByText("experimentSettings.unarchiveExperiment")).toBeInTheDocument();
  });

  it("opens dialog and confirms archive", async () => {
    const spy = server.mount(contract.experiments.updateExperiment, {
      body: createExperiment({ id: "exp-1", status: "archived" }),
    });
    const user = userEvent.setup();
    const { router } = render(<ExperimentArchive experimentId="exp-1" isArchived={false} />);

    await user.click(screen.getByText("experimentSettings.archiveExperiment"));
    expect(screen.getByText("experimentSettings.archivingExperiment")).toBeInTheDocument();

    await user.click(screen.getByText("experimentSettings.archiveDeactivate"));

    await waitFor(() => expect(spy.called).toBe(true));
    expect(spy.body).toMatchObject({ status: "archived" });
    expect(spy.params).toMatchObject({ id: "exp-1" });

    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith({
        description: "experimentSettings.experimentArchivedSuccess",
      });
    });
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(router.push).toHaveBeenCalledWith("/en-US/platform/experiments-archive");
  });

  it("opens dialog and confirms unarchive", async () => {
    server.mount(contract.experiments.updateExperiment, {
      body: createExperiment({ id: "exp-1", status: "active" }),
    });
    const user = userEvent.setup();
    const { router } = render(<ExperimentArchive experimentId="exp-1" isArchived={true} />);

    await user.click(screen.getByText("experimentSettings.unarchiveExperiment"));
    await user.click(screen.getByText("experimentSettings.unarchiveActivate"));

    await waitFor(() => {
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(router.push).toHaveBeenCalledWith("/en-US/platform/experiments");
    });
  });

  it("shows error toast on failure", async () => {
    server.mount(contract.experiments.updateExperiment, {
      status: 500,
      body: { message: "Oops" },
    });
    const user = userEvent.setup();
    render(<ExperimentArchive experimentId="exp-1" isArchived={false} />);

    await user.click(screen.getByText("experimentSettings.archiveExperiment"));
    await user.click(screen.getByText("experimentSettings.archiveDeactivate"));

    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" }));
    });
  });
});
