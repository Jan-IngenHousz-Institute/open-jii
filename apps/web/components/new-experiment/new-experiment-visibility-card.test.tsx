import { renderWithForm, screen, waitFor } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { CreateExperimentBody } from "@repo/api";

import { NewExperimentVisibilityCard } from "./new-experiment-visibility-card";

function renderVisibilityCard(defaultValues: Partial<CreateExperimentBody> = {}) {
  return renderWithForm<CreateExperimentBody>(
    (form) => (
      <>
        <div data-testid="embargo-probe">{form.watch("embargoUntil") ?? ""}</div>
        <NewExperimentVisibilityCard form={form} />
      </>
    ),
    {
      useFormProps: {
        defaultValues: {
          name: "Test Experiment",
          visibility: "private",
          embargoUntil: "",
          status: "active",
          members: [],
          description: "",
          ...defaultValues,
        },
      },
    },
  );
}

describe("<NewExperimentVisibilityCard />", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders title & description", () => {
    renderVisibilityCard({});
    expect(screen.getByText("newExperiment.visibilityTitle")).toBeInTheDocument();
    expect(screen.getByText("newExperiment.visibilityDescription")).toBeInTheDocument();
  });

  it("shows embargo section when visibility is not public", () => {
    renderVisibilityCard({ visibility: "private" });
    expect(
      screen.getByText((_content, node) => node?.textContent === "newExperiment.embargoUntil"),
    ).toBeInTheDocument();
  });

  it("hides embargo section when visibility is public", () => {
    renderVisibilityCard({ visibility: "public" });
    expect(
      screen.queryByText((_content, node) => node?.textContent === "newExperiment.embargoUntil"),
    ).not.toBeInTheDocument();
  });

  it("sets a default embargo when none is set", async () => {
    renderVisibilityCard({ visibility: "private", embargoUntil: "" });

    // wait for useEffect
    await waitFor(() => {
      expect(screen.getByTestId("embargo-probe").textContent).not.toEqual("");
    });

    // helper text exists
    expect(screen.getByText("newExperiment.embargoUntilHelperString")).toBeInTheDocument();
  });

  it("does not override an existing embargo", () => {
    const ISO = "2025-12-31T23:59:59.999Z";
    renderVisibilityCard({ visibility: "private", embargoUntil: ISO });

    // no change expected
    expect(screen.getByTestId("embargo-probe")).toHaveTextContent(ISO);
    expect(screen.getByText("newExperiment.embargoUntilHelperString")).toBeInTheDocument();
  });
});
