import { createExperiment } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { useRouter } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import type { CreateExperimentBody } from "@repo/api/domains/experiment/experiment.schema";
import { toast } from "@repo/ui/hooks/use-toast";

import { NewExperimentForm } from "../new-experiment";

const wizardState = vi.hoisted(() => ({ workbookId: undefined as string | undefined }));

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
            // The card's default-90-day effect can leave a stale embargo on the
            // form even for a public experiment; the create flow must strip it.
            embargoUntil: "2099-12-31T23:59:59.999Z",
            members: [],
            locations: [],
            workbookId: wizardState.workbookId,
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
    wizardState.workbookId = undefined;
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
    // embargoUntil is absent: it is stripped from the payload for a public
    // experiment (embargo is private-only), so the create body validates.
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

  it("creates an unpaired experiment before attaching the selected workbook", async () => {
    wizardState.workbookId = "11111111-1111-1111-1111-111111111111";
    const create = server.mount(contract.experiments.createExperiment, {
      body: { id: "exp-123" },
    });
    const attach = server.mount(contract.experiments.attachWorkbook, {
      body: {
        workbookId: wizardState.workbookId,
        workbookVersionId: "33333333-3333-3333-3333-333333333333",
        version: 1,
      },
    });
    const user = userEvent.setup();
    render(<NewExperimentForm />);

    await user.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => expect(attach.called).toBe(true));
    expect(create.body).toEqual({
      name: "Test Experiment",
      description: "Test Description",
      visibility: "public",
      members: [],
      locations: [],
    });
    expect(attach.body).toEqual({
      workbookId: wizardState.workbookId,
      expectedWorkbookId: null,
      expectedWorkbookVersionId: null,
    });
    await waitFor(() =>
      expect(vi.mocked(useRouter)().push).toHaveBeenCalledWith(
        "/en-US/platform/experiments/exp-123",
      ),
    );
  });

  it("retries a failed workbook attachment without creating a duplicate experiment", async () => {
    wizardState.workbookId = "11111111-1111-1111-1111-111111111111";
    server.mount(contract.workbooks.listWorkbooks, {
      body: [
        {
          id: wizardState.workbookId,
          name: "Workbook",
          description: null,
          cells: [],
          metadata: {},
          organizationId: null,
          visibility: "public",
          createdBy: "22222222-2222-2222-2222-222222222222",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    });
    const create = server.mount(contract.experiments.createExperiment, {
      body: { id: "exp-123" },
    });
    server.mount(contract.experiments.attachWorkbook, { status: 500 });
    server.mount(contract.experiments.getExperiment, {
      body: createExperiment({ id: "exp-123", workbookId: null, workbookVersionId: null }),
    });
    const user = userEvent.setup();
    render(<NewExperimentForm />);

    await waitFor(() => expect(screen.getByRole("button", { name: "Submit" })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Submit" })).toBeEnabled());

    expect(create.body).not.toHaveProperty("workbookId");

    const retryAttach = server.mount(contract.experiments.attachWorkbook, {
      body: {
        workbookId: wizardState.workbookId,
        workbookVersionId: "33333333-3333-3333-3333-333333333333",
        version: 1,
      },
    });
    await user.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => expect(retryAttach.called).toBe(true));
    expect(create.callCount).toBe(1);
    await waitFor(() =>
      expect(vi.mocked(useRouter)().push).toHaveBeenCalledWith(
        "/en-US/platform/experiments/exp-123",
      ),
    );
  });

  it("treats a lost attachment response as success when retry reconciliation finds it", async () => {
    wizardState.workbookId = "11111111-1111-1111-1111-111111111111";
    server.mount(contract.workbooks.listWorkbooks, {
      body: [
        {
          id: wizardState.workbookId,
          name: "Workbook",
          description: null,
          cells: [],
          metadata: {},
          organizationId: null,
          visibility: "public",
          createdBy: "22222222-2222-2222-2222-222222222222",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    });
    const create = server.mount(contract.experiments.createExperiment, {
      body: { id: "exp-123" },
    });
    const lostAttachResponse = server.mount(contract.experiments.attachWorkbook, { status: 500 });
    const user = userEvent.setup();
    render(<NewExperimentForm />);

    await waitFor(() => expect(screen.getByRole("button", { name: "Submit" })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Submit" })).toBeEnabled());

    const reconcile = server.mount(contract.experiments.getExperiment, {
      body: createExperiment({
        id: "exp-123",
        workbookId: wizardState.workbookId,
        workbookVersionId: "33333333-3333-3333-3333-333333333333",
      }),
    });
    await user.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => expect(reconcile.called).toBe(true));
    expect(create.callCount).toBe(1);
    expect(lostAttachResponse.callCount).toBe(1);
    await waitFor(() =>
      expect(vi.mocked(useRouter)().push).toHaveBeenCalledWith(
        "/en-US/platform/experiments/exp-123",
      ),
    );
  });

  it("retries instead of accepting a half-paired workbook after a lost response", async () => {
    wizardState.workbookId = "11111111-1111-1111-1111-111111111111";
    const create = server.mount(contract.experiments.createExperiment, {
      body: { id: "exp-123" },
    });
    const lostAttachResponse = server.mount(contract.experiments.attachWorkbook, { status: 500 });
    const user = userEvent.setup();
    render(<NewExperimentForm />);

    await user.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Submit" })).toBeEnabled());

    const reconcile = server.mount(contract.experiments.getExperiment, {
      body: createExperiment({
        id: "exp-123",
        workbookId: wizardState.workbookId,
        workbookVersionId: null,
      }),
    });
    const retryAttach = server.mount(contract.experiments.attachWorkbook, {
      body: {
        workbookId: wizardState.workbookId,
        workbookVersionId: "33333333-3333-3333-3333-333333333333",
        version: 1,
      },
    });
    await user.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => expect(retryAttach.called).toBe(true));
    expect(reconcile.called).toBe(true);
    expect(create.callCount).toBe(1);
    expect(lostAttachResponse.callCount).toBe(1);
    expect(retryAttach.body).toEqual({
      workbookId: wizardState.workbookId,
      expectedWorkbookId: wizardState.workbookId,
      expectedWorkbookVersionId: null,
    });
    await waitFor(() =>
      expect(vi.mocked(useRouter)().push).toHaveBeenCalledWith(
        "/en-US/platform/experiments/exp-123",
      ),
    );
  });
});
