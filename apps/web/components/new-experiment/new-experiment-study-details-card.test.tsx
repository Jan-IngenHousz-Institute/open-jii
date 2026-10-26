import { renderWithForm, screen, userEvent, waitFor } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import type { CreateExperimentBody } from "@repo/api/domains/experiment/experiment.schema";

import { NewExperimentStudyDetailsCard } from "./new-experiment-study-details-card";

function renderCard() {
  return renderWithForm<CreateExperimentBody>(
    (form) => <NewExperimentStudyDetailsCard form={form} />,
    {
      useFormProps: {
        defaultValues: {
          name: "",
          description: "",
        },
      },
    },
  );
}

describe("NewExperimentStudyDetailsCard", () => {
  it("renders every study descriptor field", () => {
    renderCard();

    expect(screen.getByLabelText("newExperiment.startDate")).toBeInTheDocument();
    expect(screen.getByLabelText("newExperiment.endDate")).toBeInTheDocument();
    expect(screen.getByLabelText("newExperiment.organism")).toBeInTheDocument();
    expect(screen.getByLabelText("newExperiment.experimentalDesign")).toBeInTheDocument();
    expect(screen.getByLabelText("newExperiment.growthFacility")).toBeInTheDocument();
    expect(screen.getByText("newExperiment.license")).toBeInTheDocument();
  });

  it("captures organism input", async () => {
    const user = userEvent.setup();
    renderCard();

    const organism = screen.getByLabelText("newExperiment.organism");
    await user.type(organism, "Arabidopsis thaliana");

    expect(organism).toHaveValue("Arabidopsis thaliana");
  });

  it("offers both licenses and none", async () => {
    const user = userEvent.setup();
    renderCard();

    await user.click(screen.getByRole("combobox"));

    await waitFor(() => {
      expect(screen.getByText("newExperiment.licenseCc0")).toBeInTheDocument();
    });
    expect(screen.getByText("newExperiment.licenseCcBy")).toBeInTheDocument();
    expect(screen.getAllByText("newExperiment.licenseNone").length).toBeGreaterThan(0);
  });

  it("flags an end date before the start date", async () => {
    const user = userEvent.setup();
    renderCard();

    await user.type(screen.getByLabelText("newExperiment.startDate"), "2026-06-30");
    await user.type(screen.getByLabelText("newExperiment.endDate"), "2026-03-01");

    await waitFor(() => {
      expect(screen.getByText("newExperiment.endBeforeStart")).toBeInTheDocument();
    });
  });
});
