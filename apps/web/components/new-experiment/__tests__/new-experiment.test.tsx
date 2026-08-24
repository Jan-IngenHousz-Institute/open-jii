import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { describe, it, expect, vi } from "vitest";

import { contract } from "@repo/api/contract";
import type { CreateExperimentBody } from "@repo/api/domains/experiment/experiment.schema";
import { toast } from "@repo/ui/hooks/use-toast";

import { NewExperimentForm } from "../new-experiment";

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
          });
        }}
      >
        <input aria-label="Experiment name" />
        <a href="#zoom-in">Zoom in</a>
        <Link href="/en-US/platform/experiments">Experiments</Link>
        <button type="submit" disabled={isSubmitting}>
          Submit
        </button>
      </form>
    ),
  };
});

describe("NewExperimentForm", () => {
  it("renders the wizard form and unsaved changes dialog", () => {
    render(<NewExperimentForm />);
    expect(screen.getByRole("form", { name: "wizard form" })).toBeInTheDocument();
    // Dialog starts closed (open={false}), so Radix Dialog content is not in the DOM
    expect(screen.queryByText("experiments.unsavedChangesTitle")).not.toBeInTheDocument();
  });

  it("allows same-document controls while guarding internal navigation", async () => {
    const user = userEvent.setup();

    render(<NewExperimentForm />);

    await user.type(screen.getByRole("textbox", { name: "Experiment name" }), "Dirty form");
    await user.click(screen.getByRole("link", { name: "Zoom in" }));

    expect(screen.queryByText("experiments.unsavedChangesTitle")).not.toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: "Experiments" }));

    expect(screen.getByText("experiments.unsavedChangesTitle")).toBeInTheDocument();
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
});
