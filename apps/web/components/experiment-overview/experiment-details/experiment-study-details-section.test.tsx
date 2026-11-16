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

  it("renders the stored descriptors", async () => {
    server.mount(contract.experiments.getStudyRecord, {
      body: {
        subjects: [
          {
            label: "Arabidopsis thaliana",
            term: {
              id: "NCBITaxon:3702",
              label: "Arabidopsis thaliana",
              vocabulary: "NCBI Taxonomy",
            },
          },
          { label: "drought stress", term: null },
        ],
        relatedWork: [{ identifier: "10.1234/example", relationType: "IsDescribedBy" }],
      },
    });
    renderSection({
      experiment: createExperiment({
        startDate: "2026-03-01",
        endDate: "2026-06-30",
        license: "CC-BY-4.0",
      }),
    });

    expect(await screen.findByText("Arabidopsis thaliana")).toBeInTheDocument();
    expect(screen.getByText("Mar 1, 2026 → Jun 30, 2026")).toBeInTheDocument();
    expect(screen.getByText("NCBITaxon:3702")).toBeInTheDocument();
    expect(screen.getByText("drought stress")).toBeInTheDocument();
    expect(screen.getByText("10.1234/example")).toBeInTheDocument();
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
    const arabidopsis = {
      id: "NCBITaxon:3702",
      label: "Arabidopsis thaliana",
      vocabulary: "NCBI Taxonomy",
    };
    server.mount(contract.experiments.searchColumnTerms, { body: { terms: [arabidopsis] } });
    const experiment = createExperiment({ organism: "Zea mays" });

    renderSection({ experiment, hasAccess: true });
    await user.click(screen.getByText("common.edit"));

    await user.click(screen.getByRole("button", { name: "subjects.add" }));
    await user.type(screen.getByPlaceholderText("subjects.searchPlaceholder"), "thale");
    await user.click(await screen.findByRole("option", { name: /Arabidopsis thaliana/ }));
    await user.click(screen.getByText("common.save"));

    await waitFor(() => expect(spy.called).toBe(true));
    expect(spy.calls.at(-1)?.body).toEqual({
      startDate: null,
      endDate: null,
      subjects: [
        { label: "Zea mays", term: null },
        { label: "Arabidopsis thaliana", term: arabidopsis },
      ],
      experimentalDesign: null,
      relatedWork: [],
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
