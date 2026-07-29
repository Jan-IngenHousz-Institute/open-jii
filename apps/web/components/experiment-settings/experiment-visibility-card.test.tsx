import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import type { ComponentProps } from "react";
import { describe, it, expect } from "vitest";

import { contract } from "@repo/api/contract";

import { ExperimentVisibilityCard } from "./experiment-visibility-card";

describe("<ExperimentVisibilityCard />", () => {
  function renderCard(props?: Partial<ComponentProps<typeof ExperimentVisibilityCard>>) {
    const defaultProps: ComponentProps<typeof ExperimentVisibilityCard> = {
      experimentId: "exp-123",
      initialVisibility: "private",
      embargoUntil: "2025-12-31T23:59:59.999Z",
      initialAnonymize: false,
    };
    return render(<ExperimentVisibilityCard {...defaultProps} {...props} />);
  }

  it("renders title and description", () => {
    renderCard();
    expect(screen.getByText("experimentVisibility.visibilityCardTitle")).toBeInTheDocument();
    expect(screen.getByText("experimentVisibility.visibilityCardDescription")).toBeInTheDocument();
  });

  it("while private: shows the embargo editor and a Publish action", () => {
    renderCard({ initialVisibility: "private" });

    expect(
      screen.getByText((_, node) => node?.textContent === "experimentSettings.embargoUntil"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "experimentVisibility.publishAction" }),
    ).toBeInTheDocument();
    // The private state is not the terminal published state.
    expect(screen.queryByText("experimentVisibility.publishedDescription")).not.toBeInTheDocument();
  });

  it("shows embargo helper text while private", () => {
    renderCard({
      initialVisibility: "private",
      embargoUntil: "2026-01-15T23:59:59.999Z",
    });

    expect(screen.getByText("experimentSettings.embargoUntil")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Jan 1[56], 2026/ })).toBeInTheDocument();
    expect(screen.getByText("newExperiment.embargoUntilHelperString")).toBeInTheDocument();
  });

  it("once public: static state, no embargo editor, no Publish action", () => {
    renderCard({ initialVisibility: "public" });

    expect(
      screen.queryByText((_, node) => node?.textContent === "experimentSettings.embargoUntil"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "experimentVisibility.publishAction" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("experimentVisibility.publishedDescription")).toBeInTheDocument();
    expect(screen.getByText("experimentVisibility.publicStatus")).toBeInTheDocument();
  });

  it("publishing calls setVisibility and moves the card to the public state", async () => {
    const spy = server.mount(contract.experiments.setVisibility);
    const user = userEvent.setup();

    renderCard({ initialVisibility: "private" });

    await user.click(screen.getByRole("button", { name: "experimentVisibility.publishAction" }));
    // Confirm the irreversible action in the dialog.
    await user.click(
      screen.getByRole("button", { name: "experimentVisibility.publishConfirmButton" }),
    );

    await waitFor(() => expect(spy.called).toBe(true));
    expect(spy.params).toMatchObject({ id: "exp-123" });

    await waitFor(() =>
      expect(screen.getByText("experimentVisibility.publishedDescription")).toBeInTheDocument(),
    );
  });

  it("syncs to the public static state when the visibility prop changes (refetch elsewhere)", () => {
    const { rerender } = renderCard({ initialVisibility: "private" });

    // Starts private: publish control present, not yet in the published state.
    expect(
      screen.getByRole("button", { name: "experimentVisibility.publishAction" }),
    ).toBeInTheDocument();

    // Published elsewhere (cron / another tab) → query refetches to public.
    rerender(
      <ExperimentVisibilityCard
        experimentId="exp-123"
        initialVisibility="public"
        embargoUntil="2025-12-31T23:59:59.999Z"
        initialAnonymize={false}
      />,
    );

    expect(screen.getByText("experimentVisibility.publishedDescription")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "experimentVisibility.publishAction" }),
    ).not.toBeInTheDocument();
  });
});
