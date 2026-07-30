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

  /** The visibility select, by the label pointing at its trigger. */
  function visibilitySelect() {
    return screen.getByRole("combobox", { name: "experimentSettings.visibility" });
  }

  it("renders title and description", () => {
    renderCard();
    expect(screen.getByText("experimentVisibility.visibilityCardTitle")).toBeInTheDocument();
    expect(screen.getByText("experimentVisibility.visibilityCardDescription")).toBeInTheDocument();
  });

  it("while private: an enabled visibility select and the embargo editor", () => {
    renderCard({ initialVisibility: "private" });

    expect(visibilitySelect()).toBeEnabled();
    expect(visibilitySelect()).toHaveTextContent("Private");
    expect(
      screen.getByText((_, node) => node?.textContent === "experimentSettings.embargoUntil"),
    ).toBeInTheDocument();
    // Publishing happens through the select: nothing is proposed until a value is
    // chosen, so the confirmation is not on screen yet.
    expect(screen.queryByText("experimentVisibility.changeToPublicTitle")).not.toBeInTheDocument();
    expect(screen.queryByText("resourceVisibility.publishedDescription")).not.toBeInTheDocument();
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

  it("once public: the select is inert and says so, and the embargo editor is gone", () => {
    renderCard({ initialVisibility: "public" });

    expect(visibilitySelect()).toBeDisabled();
    expect(visibilitySelect()).toHaveTextContent("Public");
    // The reason it is inert stays a block under the select: this card stacks
    // full-width rows, so a wrapped line or two costs nothing.
    expect(screen.getByText("resourceVisibility.publishedDescription")).toBeInTheDocument();
    expect(
      screen.queryByText((_, node) => node?.textContent === "experimentSettings.embargoUntil"),
    ).not.toBeInTheDocument();
  });

  it("locks the select on an archived experiment", () => {
    renderCard({ initialVisibility: "private", isArchived: true });

    expect(visibilitySelect()).toBeDisabled();
  });

  it("choosing public confirms first and writes nothing until then", async () => {
    const spy = server.mount(contract.experiments.setVisibility);
    const user = userEvent.setup();

    renderCard({ initialVisibility: "private" });

    await user.click(visibilitySelect());
    await user.click(screen.getByRole("option", { name: "Public" }));

    expect(screen.getByText("experimentVisibility.changeToPublicTitle")).toBeInTheDocument();
    expect(spy.called).toBe(false);
  });

  it("publishing calls setVisibility and moves the card to the public state", async () => {
    const spy = server.mount(contract.experiments.setVisibility);
    const user = userEvent.setup();

    renderCard({ initialVisibility: "private" });

    await user.click(visibilitySelect());
    await user.click(screen.getByRole("option", { name: "Public" }));
    // Confirm the irreversible action in the dialog.
    await user.click(
      screen.getByRole("button", { name: "experimentVisibility.publishConfirmButton" }),
    );

    await waitFor(() => expect(spy.called).toBe(true));
    expect(spy.params).toMatchObject({ id: "exp-123" });

    await waitFor(() =>
      expect(screen.getByText("resourceVisibility.publishedDescription")).toBeInTheDocument(),
    );
    expect(visibilitySelect()).toBeDisabled();
  });

  it("cancelling leaves the experiment private", async () => {
    const spy = server.mount(contract.experiments.setVisibility);
    const user = userEvent.setup();

    renderCard({ initialVisibility: "private" });

    await user.click(visibilitySelect());
    await user.click(screen.getByRole("option", { name: "Public" }));
    await user.click(screen.getByRole("button", { name: "common.cancel" }));

    expect(spy.called).toBe(false);
    // The select never left the persisted value: it reflects visibility rather
    // than owning it.
    expect(visibilitySelect()).toHaveTextContent("Private");
    expect(visibilitySelect()).toBeEnabled();
  });

  it("syncs to the public state when the visibility prop changes (refetch elsewhere)", () => {
    const { rerender } = renderCard({ initialVisibility: "private" });

    expect(visibilitySelect()).toBeEnabled();

    // Published elsewhere (cron / another tab) → query refetches to public.
    rerender(
      <ExperimentVisibilityCard
        experimentId="exp-123"
        initialVisibility="public"
        embargoUntil="2025-12-31T23:59:59.999Z"
        initialAnonymize={false}
      />,
    );

    expect(visibilitySelect()).toBeDisabled();
    expect(screen.getByText("resourceVisibility.publishedDescription")).toBeInTheDocument();
  });
});
