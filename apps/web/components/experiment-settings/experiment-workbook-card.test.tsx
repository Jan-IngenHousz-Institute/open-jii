import { createExperiment, createWorkbook } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { contract } from "@repo/api/contract";

import { ExperimentWorkbookCard } from "./experiment-workbook-card";

const workbooks = [
  createWorkbook({ id: "wb-1", name: "Photosynthesis Lab" }),
  createWorkbook({ id: "wb-2", name: "Soil Analysis" }),
];

describe("ExperimentWorkbookCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    server.mount(contract.workbooks.listWorkbooks, { body: workbooks });
  });

  it("shows the workbook dropdown with available workbooks", async () => {
    const user = userEvent.setup();
    const experiment = createExperiment({ workbookId: null });
    render(<ExperimentWorkbookCard experimentId={experiment.id} experiment={experiment} />);

    // Open the select dropdown
    await user.click(screen.getByRole("combobox"));

    // User should see the two available workbooks listed
    await waitFor(() => {
      expect(screen.getByText("Photosynthesis Lab")).toBeInTheDocument();
      expect(screen.getByText("Soil Analysis")).toBeInTheDocument();
    });
    // "No workbook" option appears in both trigger and dropdown
    expect(screen.getAllByText("newExperiment.noWorkbook").length).toBeGreaterThanOrEqual(1);
  });

  it("attaches a workbook when the user selects one", async () => {
    const user = userEvent.setup();
    const experiment = createExperiment({ workbookId: null });
    const attachSpy = server.mount(contract.experiments.attachWorkbook, {
      body: { workbookId: "wb-1", workbookVersionId: "wv-1", version: 1 },
    });

    render(<ExperimentWorkbookCard experimentId={experiment.id} experiment={experiment} />);

    await user.click(screen.getByRole("combobox"));
    await waitFor(() => expect(screen.getByText("Photosynthesis Lab")).toBeInTheDocument());
    await user.click(screen.getByText("Photosynthesis Lab"));

    await waitFor(() => {
      expect(attachSpy.body).toEqual({ workbookId: "wb-1" });
    });
  });

  it("detaches the workbook when the user selects 'no workbook'", async () => {
    const user = userEvent.setup();
    const experiment = createExperiment({ workbookId: "wb-1" });
    const detachSpy = server.mount(contract.experiments.detachWorkbook, {
      body: createExperiment({ ...experiment, workbookId: null }),
    });

    render(<ExperimentWorkbookCard experimentId={experiment.id} experiment={experiment} />);

    await user.click(screen.getByRole("combobox"));
    await waitFor(() => expect(screen.getByText("newExperiment.noWorkbook")).toBeInTheDocument());
    await user.click(screen.getByText("newExperiment.noWorkbook"));

    await waitFor(() => {
      expect(detachSpy.params.id).toBe(experiment.id);
    });
  });

  it("disables the dropdown when the experiment is archived", () => {
    const experiment = createExperiment({ workbookId: null });
    render(
      <ExperimentWorkbookCard experimentId={experiment.id} experiment={experiment} isArchived />,
    );
    expect(screen.getByRole("combobox")).toBeDisabled();
  });
});
