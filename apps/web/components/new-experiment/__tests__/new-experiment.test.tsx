import { server } from "@/test/msw/server";
import { structuralIssue, structuralValidationErrorBody } from "@/test/orpc-error";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { useRouter } from "next/navigation";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { contract } from "@repo/api/contract";
import type { CreateExperimentBody } from "@repo/api/domains/experiment/experiment.schema";
import { toast } from "@repo/ui/hooks/use-toast";

import { NewExperimentForm } from "../new-experiment";

// The mocked wizard submits this optional workbook id so tests can exercise the
// create-then-attach path (undefined by default: create-only).
let submittedWorkbookId: string | undefined;

vi.mock("@repo/ui/components/wizard-form", async (importOriginal) => {
  const actual: Record<string, unknown> = await importOriginal();
  return {
    ...actual,
    WizardForm: ({
      onSubmit,
      isSubmitting,
    }: {
      onSubmit: (data: CreateExperimentBody) => void;
      isSubmitting?: boolean;
    }) => (
      <form
        aria-label="wizard form"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({
            name: "Test Experiment",
            description: "Test Description",
            visibility: "public",
            members: [],
            locations: [],
            ...(submittedWorkbookId ? { workbookId: submittedWorkbookId } : {}),
          });
        }}
      >
        <button type="submit" disabled={isSubmitting}>
          Submit
        </button>
      </form>
    ),
  };
});

describe("NewExperimentForm", () => {
  beforeEach(() => {
    submittedWorkbookId = undefined;
  });

  it("renders the wizard form and unsaved changes dialog", () => {
    render(<NewExperimentForm />);
    expect(screen.getByRole("form", { name: "wizard form" })).toBeInTheDocument();
    // Dialog starts closed (open={false}), so Radix Dialog content is not in the DOM
    expect(screen.queryByText("experiments.unsavedChangesTitle")).not.toBeInTheDocument();
  });

  it("submits experiment and navigates on success", async () => {
    const user = userEvent.setup();
    const spy = server.mount(contract.experiments.createExperiment, {
      body: { id: "exp-123" },
    });

    render(<NewExperimentForm />);

    await user.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => {
      expect(spy.callCount).toBe(1);
    });
    expect(spy.body).toEqual({
      name: "Test Experiment",
      description: "Test Description",
      visibility: "public",
      members: [],
      locations: [],
    });

    await waitFor(() => {
      expect(vi.mocked(toast)).toHaveBeenCalledWith({
        description: "experiments.experimentCreated",
      });
    });

    await waitFor(() => {
      expect(vi.mocked(useRouter)().push).toHaveBeenCalledWith(
        "/en-US/platform/experiments/exp-123",
      );
    });
  });

  it("attaches the selected workbook and reports creation success only on attach success", async () => {
    submittedWorkbookId = "wb-1";
    const user = userEvent.setup();
    server.mount(contract.experiments.createExperiment, { body: { id: "exp-9" } });
    const attachSpy = server.mount(contract.experiments.attachWorkbook, {
      body: { workbookId: "wb-1", workbookVersionId: "ver-1", version: 1 },
    });

    render(<NewExperimentForm />);
    await user.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => expect(attachSpy.called).toBe(true));
    await waitFor(() =>
      expect(vi.mocked(toast)).toHaveBeenCalledWith({
        description: "experiments.experimentCreated",
      }),
    );
    expect(vi.mocked(useRouter)().push).toHaveBeenCalledWith("/en-US/platform/experiments/exp-9");
  });

  it("keeps a durable repair context (not a toast) after a structural attach rejection", async () => {
    submittedWorkbookId = "wb-1";
    const user = userEvent.setup();
    server.mount(contract.experiments.createExperiment, { body: { id: "exp-9" } });
    server.mount(contract.experiments.attachWorkbook, {
      status: 400,
      body: structuralValidationErrorBody(
        [
          structuralIssue({ commandCellId: "cmd-a", secretLeak: "TOP-SECRET" }),
          structuralIssue({ commandCellId: "cmd-b", index: 2 }),
        ],
        { secretTop: "TOP-SECRET" },
      ),
    });

    render(<NewExperimentForm />);
    await user.click(screen.getByRole("button", { name: "Submit" }));

    // A durable creation-result panel appears, announced as an alert, listing
    // every command id with guidance; the projection carries no sentinel.
    const panel = await screen.findByTestId("experiment-created-unattached");
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("cmd-a");
    expect(alert).toHaveTextContent("cmd-b");
    expect(panel).toHaveTextContent("experiments.experimentCreatedUnattachedTitle");
    expect(screen.queryByText(/TOP-SECRET/)).not.toBeInTheDocument();

    // Exact locale-aware repair link to the attempted workbook + link to the
    // created (unattached) experiment.
    expect(
      screen.getByRole("link", { name: "flow.structuralAttach.openWorkbook" }),
    ).toHaveAttribute("href", "/en-US/platform/workbooks/wb-1");
    expect(screen.getByRole("link", { name: "experiments.openCreatedExperiment" })).toHaveAttribute(
      "href",
      "/en-US/platform/experiments/exp-9",
    );

    // No false attached success and no toast-only navigate-away.
    expect(vi.mocked(toast)).not.toHaveBeenCalledWith({
      description: "experiments.experimentCreated",
    });
    expect(vi.mocked(useRouter)().push).not.toHaveBeenCalled();
  });

  it("reports a generic attach failure separately from creation success", async () => {
    submittedWorkbookId = "wb-1";
    const user = userEvent.setup();
    server.mount(contract.experiments.createExperiment, { body: { id: "exp-9" } });
    server.mount(contract.experiments.attachWorkbook, { status: 500 });

    render(<NewExperimentForm />);
    await user.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() =>
      expect(vi.mocked(toast)).toHaveBeenCalledWith({
        description: "experiments.experimentCreatedAttachFailed",
        variant: "destructive",
      }),
    );
    expect(vi.mocked(toast)).not.toHaveBeenCalledWith({
      description: "experiments.experimentCreated",
    });
  });
});
