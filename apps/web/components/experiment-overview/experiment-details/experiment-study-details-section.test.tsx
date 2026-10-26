import { createExperiment } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import type { ComponentProps } from "react";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";

import { ExperimentStudyDetailsSection } from "./experiment-study-details-section";

describe("<ExperimentStudyDetailsSection />", () => {
  function renderSection(props?: Partial<ComponentProps<typeof ExperimentStudyDetailsSection>>) {
    const experiment = props?.experiment ?? createExperiment();
    const defaults: ComponentProps<typeof ExperimentStudyDetailsSection> = {
      experimentId: experiment.id,
      experiment,
      hasAccess: false,
      isArchived: false,
    };
    return render(<ExperimentStudyDetailsSection {...defaults} {...props} />);
  }

  it("renders the empty state when no descriptor is set", () => {
    renderSection();
    expect(screen.getByText("studyDetails.empty")).toBeInTheDocument();
  });

  it("renders the stored descriptors", () => {
    renderSection({
      experiment: createExperiment({
        startDate: "2026-03-01",
        endDate: "2026-06-30",
        organism: "Arabidopsis thaliana",
        growthFacility: "Greenhouse compartment 2",
        license: "CC-BY-4.0",
      }),
    });

    expect(screen.getByText("Mar 1, 2026 → Jun 30, 2026")).toBeInTheDocument();
    expect(screen.getByText("Arabidopsis thaliana")).toBeInTheDocument();
    expect(screen.getByText("Greenhouse compartment 2")).toBeInTheDocument();
    expect(screen.getByText("studyDetails.licenseCcByShort")).toBeInTheDocument();
  });

  it("lists an empty field as not set for someone who may edit", () => {
    renderSection({ experiment: createExperiment({ organism: "Zea mays" }), hasAccess: true });

    expect(screen.getByText("Zea mays")).toBeInTheDocument();
    expect(screen.getAllByText("studyDetails.notSet")).toHaveLength(5);
  });

  it("leaves an empty field out for someone who may not edit", () => {
    renderSection({ experiment: createExperiment({ organism: "Zea mays" }), hasAccess: false });

    expect(screen.getByText("Zea mays")).toBeInTheDocument();
    expect(screen.queryByText("studyDetails.notSet")).not.toBeInTheDocument();
  });

  it("hides the edit affordance without access", () => {
    renderSection({ hasAccess: false });
    expect(screen.queryByText("common.edit")).not.toBeInTheDocument();
  });

  it("hides the edit affordance when archived", () => {
    renderSection({ hasAccess: true, isArchived: true });
    expect(screen.queryByText("common.edit")).not.toBeInTheDocument();
  });

  it("saves edited descriptors, clearing emptied ones to null", async () => {
    const user = userEvent.setup();
    const spy = server.mount(contract.experiments.updateExperiment, { status: 200 });
    server.mount(contract.experiments.searchOrganisms, {
      body: { organisms: [{ taxonId: "3702", name: "Arabidopsis thaliana" }] },
    });
    const experiment = createExperiment({ organism: "Zea mays" });

    renderSection({ experiment, hasAccess: true });
    await user.click(screen.getByText("common.edit"));

    await user.click(screen.getByRole("combobox", { name: "studyDetails.organism" }));
    await user.type(screen.getByPlaceholderText("organism.searchPlaceholder"), "thale");
    await user.click(await screen.findByRole("option", { name: /Arabidopsis thaliana/ }));
    await user.click(screen.getByText("common.save"));

    await waitFor(() => expect(spy.called).toBe(true));
    expect(spy.calls.at(-1)?.body).toEqual({
      startDate: null,
      endDate: null,
      organism: "Arabidopsis thaliana",
      experimentalDesign: null,
      growthFacility: null,
      license: null,
      fundingReferences: [],
    });
  });

  it("rejects an inverted date pair in the dialog", async () => {
    const user = userEvent.setup();
    const spy = server.mount(contract.experiments.updateExperiment, { status: 200 });

    renderSection({ experiment: createExperiment(), hasAccess: true });
    await user.click(screen.getByText("common.edit"));

    await user.type(screen.getByLabelText("studyDetails.startDate"), "2026-06-30");
    await user.type(screen.getByLabelText("studyDetails.endDate"), "2026-03-01");
    await user.click(screen.getByText("common.save"));

    await waitFor(() =>
      expect(screen.getByText("End date cannot be before the start date")).toBeInTheDocument(),
    );
    expect(spy.called).toBe(false);
  });
});
