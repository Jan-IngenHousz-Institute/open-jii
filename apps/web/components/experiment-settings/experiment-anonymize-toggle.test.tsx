import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import type { ComponentProps } from "react";
import { describe, expect, it } from "vitest";

import { orpcContract } from "@repo/api/orpc-contract";

import { ExperimentAnonymizeToggle } from "./experiment-anonymize-toggle";

describe("<ExperimentAnonymizeToggle />", () => {
  function renderToggle(props?: Partial<ComponentProps<typeof ExperimentAnonymizeToggle>>) {
    const defaults: ComponentProps<typeof ExperimentAnonymizeToggle> = {
      experimentId: "exp-1",
      initialAnonymize: false,
    };
    return render(<ExperimentAnonymizeToggle {...defaults} {...props} />);
  }

  it("renders the title and description copy", () => {
    renderToggle();
    expect(screen.getByText("experimentAnonymize.title")).toBeInTheDocument();
    expect(screen.getByText("experimentAnonymize.description")).toBeInTheDocument();
  });

  it("reflects initialAnonymize on first render", () => {
    renderToggle({ initialAnonymize: true });
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
  });

  it("calls updateExperiment with the toggled value when flipped", async () => {
    const user = userEvent.setup();
    const spy = server.mount(orpcContract.experiments.updateExperiment, { status: 200 });

    renderToggle({ initialAnonymize: false });
    await user.click(screen.getByRole("switch"));

    await waitFor(() => expect(spy.called).toBe(true));
    expect(spy.calls.at(-1)?.body).toEqual({ anonymizeContributors: true });
  });

  it("reverts the switch when the update mutation fails", async () => {
    const user = userEvent.setup();
    server.mount(orpcContract.experiments.updateExperiment, { status: 500 });

    renderToggle({ initialAnonymize: false });
    const switchEl = screen.getByRole("switch");
    await user.click(switchEl);

    await waitFor(() => expect(switchEl).toHaveAttribute("aria-checked", "false"));
  });

  it("disables the switch when archived", () => {
    renderToggle({ isArchived: true });
    expect(screen.getByRole("switch")).toBeDisabled();
  });
});
