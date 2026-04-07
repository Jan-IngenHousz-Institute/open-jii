import { createExperiment } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { describe, it, expect } from "vitest";

import { contract } from "@repo/api";

import { ExperimentTitle } from "./experiment-title";

function renderComponent(
  props: {
    experimentId?: string;
    name?: string;
    status?: string;
    visibility?: string;
    hasAccess?: boolean;
    isArchived?: boolean;
  } = {},
) {
  const defaultProps = {
    experimentId: props.experimentId ?? "exp-123",
    name: props.name ?? "Test Experiment",
    status: props.status ?? "active",
    visibility: props.visibility ?? "public",
    hasAccess: props.hasAccess ?? false,
    isArchived: props.isArchived ?? false,
  };

  return render(<ExperimentTitle {...defaultProps} />);
}

describe("ExperimentTitle", () => {
  it("renders experiment title", () => {
    renderComponent({ name: "My Experiment" });
    expect(screen.getByText("My Experiment")).toBeInTheDocument();
  });

  it("renders status badge for active experiments", () => {
    renderComponent({ status: "active" });
    expect(screen.getByText("status.active")).toBeInTheDocument();
  });

  it("renders status badge for archived experiments", () => {
    renderComponent({ status: "archived" });
    expect(screen.getByText("status.archived")).toBeInTheDocument();
  });

  it("renders status badge for stale experiments", () => {
    renderComponent({ status: "stale" });
    expect(screen.getByText("status.stale")).toBeInTheDocument();
  });

  it("renders status badge for published experiments", () => {
    renderComponent({ status: "published" });
    expect(screen.getByText("status.published")).toBeInTheDocument();
  });

  it("renders public visibility badge", () => {
    renderComponent({ visibility: "public" });
    expect(screen.getByText("public")).toBeInTheDocument();
  });

  it("renders private visibility badge", () => {
    renderComponent({ visibility: "private" });
    expect(screen.getByText("private")).toBeInTheDocument();
  });

  it("enters edit mode when title is clicked with access", async () => {
    const user = userEvent.setup();
    renderComponent({ name: "Editable Title", hasAccess: true, isArchived: false });

    const titleElement = screen.getByText("Editable Title");
    await user.click(titleElement);

    expect(screen.getByDisplayValue("Editable Title")).toBeInTheDocument();
    expect(screen.getByLabelText("Save")).toBeInTheDocument();
    expect(screen.getByLabelText("Cancel")).toBeInTheDocument();
  });

  it("does not enter edit mode when archived", async () => {
    const user = userEvent.setup();
    renderComponent({ name: "Archived Title", hasAccess: true, isArchived: true });

    const titleElement = screen.getByText("Archived Title");
    await user.click(titleElement);

    expect(screen.queryByDisplayValue("Archived Title")).not.toBeInTheDocument();
  });

  it("does not enter edit mode without access", async () => {
    const user = userEvent.setup();
    renderComponent({ name: "No Access Title", hasAccess: false, isArchived: false });

    const titleElement = screen.getByText("No Access Title");
    await user.click(titleElement);

    expect(screen.queryByDisplayValue("No Access Title")).not.toBeInTheDocument();
  });

  it("cancels edit mode and resets text", async () => {
    const user = userEvent.setup();
    renderComponent({ name: "Original Title", hasAccess: true });

    const titleElement = screen.getByText("Original Title");
    await user.click(titleElement);

    const input = screen.getByDisplayValue("Original Title");
    await user.clear(input);
    await user.type(input, "Changed Title");

    const cancelButton = screen.getByLabelText("Cancel");
    await user.click(cancelButton);

    expect(screen.queryByDisplayValue("Changed Title")).not.toBeInTheDocument();
    expect(screen.getByText("Original Title")).toBeInTheDocument();
  });

  it("saves title successfully", async () => {
    const spy = server.mount(contract.experiments.updateExperiment, {
      body: createExperiment({ id: "exp-456" }),
    });
    const user = userEvent.setup();
    renderComponent({ experimentId: "exp-456", name: "Old Title", hasAccess: true });

    const titleElement = screen.getByText("Old Title");
    await user.click(titleElement);

    const input = screen.getByDisplayValue("Old Title");
    await user.clear(input);
    await user.type(input, "New Title");

    const saveButton = screen.getByLabelText("Save");
    await user.click(saveButton);

    await waitFor(() => expect(spy.called).toBe(true));
    expect(spy.body).toMatchObject({ name: "New Title" });
    expect(spy.params).toMatchObject({ id: "exp-456" });
  });

  it("does not save if title is unchanged", async () => {
    const spy = server.mount(contract.experiments.updateExperiment, {
      body: createExperiment(),
    });
    const user = userEvent.setup();
    renderComponent({ name: "Same Title", hasAccess: true });

    const titleElement = screen.getByText("Same Title");
    await user.click(titleElement);

    const saveButton = screen.getByLabelText("Save");
    await user.click(saveButton);

    expect(spy.called).toBe(false);
  });

  it("does not save if title is empty", async () => {
    const spy = server.mount(contract.experiments.updateExperiment, {
      body: createExperiment(),
    });
    const user = userEvent.setup();
    renderComponent({ name: "Some Title", hasAccess: true });

    const titleElement = screen.getByText("Some Title");
    await user.click(titleElement);

    const input = screen.getByDisplayValue("Some Title");
    await user.clear(input);

    const saveButton = screen.getByLabelText("Save");
    await user.click(saveButton);

    expect(spy.called).toBe(false);
  });
});
