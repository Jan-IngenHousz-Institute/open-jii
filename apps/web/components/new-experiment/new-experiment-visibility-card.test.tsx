import "@testing-library/jest-dom";
import { render, screen, waitFor, act } from "@testing-library/react";
import React from "react";
import { useForm, FormProvider } from "react-hook-form";
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { CreateExperimentBody } from "@repo/api";

import { NewExperimentVisibilityCard } from "./new-experiment-visibility-card";

globalThis.React = React;

// --- mock i18n
vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({
    t: (k: string) => k,
  }),
}));

function renderWithForm(defaultValues: Partial<CreateExperimentBody>) {
  function Host() {
    const methods = useForm<CreateExperimentBody>({
      defaultValues: {
        name: "Test Experiment",
        visibility: "private",
        embargoUntil: "",
        status: "active",
        members: [],
        description: "",
        ...defaultValues,
      },
    });
    const embargo = methods.watch("embargoUntil");
    return (
      <FormProvider {...methods}>
        <div data-testid="embargo-probe">{embargo ?? ""}</div>
        <NewExperimentVisibilityCard form={methods} />
      </FormProvider>
    );
  }
  return render(<Host />);
}

describe("<NewExperimentVisibilityCard />", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders title & description", async () => {
    await act(async () => {
      renderWithForm({});
    });
    expect(screen.getByText("newExperiment.visibilityTitle")).toBeInTheDocument();
    expect(screen.getByText("newExperiment.visibilityDescription")).toBeInTheDocument();
  });

  it("shows embargo section when visibility is not public", async () => {
    await act(async () => {
      renderWithForm({ visibility: "private" });
    });
    expect(
      screen.getByText((_content, node) => node?.textContent === "newExperiment.embargoUntil"),
    ).toBeInTheDocument();
  });

  it("hides embargo section when visibility is public", async () => {
    await act(async () => {
      renderWithForm({ visibility: "public" });
    });
    expect(
      screen.queryByText((_content, node) => node?.textContent === "newExperiment.embargoUntil"),
    ).not.toBeInTheDocument();
  });

  it("sets a default embargo when none is set", async () => {
    renderWithForm({ visibility: "private", embargoUntil: "" });

    // wait for useEffect
    await waitFor(() => {
      expect(screen.getByTestId("embargo-probe").textContent).not.toEqual("");
    });

    // helper text exists
    expect(screen.getByText("newExperiment.embargoUntilHelperString")).toBeInTheDocument();
  });

  it("does not override an existing embargo", () => {
    const ISO = "2025-12-31T23:59:59.999Z";
    renderWithForm({ visibility: "private", embargoUntil: ISO });

    // no change expected
    expect(screen.getByTestId("embargo-probe")).toHaveTextContent(ISO);
    expect(screen.getByText("newExperiment.embargoUntilHelperString")).toBeInTheDocument();
  });
});
