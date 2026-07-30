import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import type { ComponentProps } from "react";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";
import { toast } from "@repo/ui/hooks/use-toast";

import { ResourcePublishControl } from "./resource-publish-control";

function renderControl(overrides: Partial<ComponentProps<typeof ResourcePublishControl>> = {}) {
  const defaults: ComponentProps<typeof ResourcePublishControl> = {
    resourceType: "macro",
    resourceId: "macro-1",
    visibility: "private",
    canManage: true,
  };
  return render(<ResourcePublishControl {...defaults} {...overrides} />);
}

/** The visibility select, by the accessible name its trigger carries. */
function visibilitySelect() {
  return screen.getByRole("combobox", { name: "resourceVisibility.statusLabel" });
}

/** Open the select and choose an option, the way a user does. */
async function choose(user: ReturnType<typeof userEvent.setup>, option: string) {
  await user.click(visibilitySelect());
  await user.click(screen.getByRole("option", { name: option }));
}

describe("<ResourcePublishControl />", () => {
  it("offers an enabled select showing the private state to a manager", () => {
    renderControl({ visibility: "private", canManage: true });

    expect(visibilitySelect()).toBeEnabled();
    expect(visibilitySelect()).toHaveTextContent("resourceVisibility.privateStatus");
    // No standalone Publish button any more — the select is the control.
    expect(
      screen.queryByRole("button", { name: "resourceVisibility.publishAction" }),
    ).not.toBeInTheDocument();
  });

  it("locks the select for a caller who cannot manage, but still shows the state", () => {
    renderControl({ visibility: "private", canManage: false });

    // A viewer should know it is private; publishing is manage-gated, matching
    // what the route enforces.
    expect(visibilitySelect()).toBeDisabled();
    expect(visibilitySelect()).toHaveTextContent("resourceVisibility.privateStatus");
  });

  it("locks the select once public, even for a manager", () => {
    renderControl({ visibility: "public", canManage: true });

    // Visibility is monotonic: there is nothing left to choose.
    expect(visibilitySelect()).toBeDisabled();
    expect(visibilitySelect()).toHaveTextContent("resourceVisibility.publicStatus");
  });

  it("renders the explanatory copy as a block by default, like the experiment card", () => {
    renderControl({ visibility: "private" });

    // On screen, not behind a hover: the details sidebars stack full-width rows,
    // so the copy can have a line of its own there.
    expect(screen.getByText("resourceVisibility.privateDescription")).toBeInTheDocument();
    expect(
      screen.queryByLabelText("resourceVisibility.privateDescription"),
    ).not.toBeInTheDocument();
  });

  it("switches the block to the published wording once public", () => {
    renderControl({ visibility: "public" });

    expect(screen.getByText("resourceVisibility.publishedDescription")).toBeInTheDocument();
    expect(screen.queryByText("resourceVisibility.privateDescription")).not.toBeInTheDocument();
  });

  it("moves the copy onto an info icon when the host asks for the tooltip", async () => {
    const user = userEvent.setup();
    renderControl({ visibility: "private", infoPlacement: "tooltip" });

    // A host laying its fields out horizontally has no line to spare, so the copy
    // is the icon's accessible name — readable without hovering — and nothing
    // occupies a row of its own.
    expect(screen.queryByText("resourceVisibility.privateDescription")).not.toBeInTheDocument();
    const help = screen.getByLabelText("resourceVisibility.privateDescription");

    await user.hover(help);
    await waitFor(() =>
      expect(screen.getAllByText("resourceVisibility.privateDescription").length).toBeGreaterThan(
        0,
      ),
    );
  });

  it("uses the published wording on the tooltip too", () => {
    renderControl({ visibility: "public", infoPlacement: "tooltip" });

    expect(screen.getByLabelText("resourceVisibility.publishedDescription")).toBeInTheDocument();
    expect(
      screen.queryByLabelText("resourceVisibility.privateDescription"),
    ).not.toBeInTheDocument();
  });

  it("requires confirmation and then publishes, moving to the public state", async () => {
    const user = userEvent.setup();
    const spy = server.mount(contract.macros.setVisibility, {
      body: { id: "macro-1", visibility: "public" },
    });

    renderControl({ resourceType: "macro", resourceId: "macro-1", visibility: "private" });

    await choose(user, "resourceVisibility.publicStatus");

    // Irreversible, so it is confirmed rather than written on the choice itself.
    expect(screen.getByText("resourceVisibility.publishConfirmTitle")).toBeInTheDocument();
    expect(screen.getByText("resourceVisibility.publishConfirmDescription")).toBeInTheDocument();
    expect(spy.called).toBe(false);

    await user.click(
      screen.getByRole("button", { name: "resourceVisibility.publishConfirmButton" }),
    );

    await waitFor(() => expect(spy.called).toBe(true));
    expect(spy.params).toMatchObject({ id: "macro-1" });
    expect(spy.body).toEqual({ visibility: "public" });

    await waitFor(() =>
      expect(visibilitySelect()).toHaveTextContent("resourceVisibility.publicStatus"),
    );
    expect(visibilitySelect()).toBeDisabled();
  });

  it("cancelling the confirmation publishes nothing and leaves the select private", async () => {
    const user = userEvent.setup();
    const spy = server.mount(contract.macros.setVisibility, {
      body: { id: "macro-1", visibility: "public" },
    });

    renderControl({ visibility: "private" });

    await choose(user, "resourceVisibility.publicStatus");
    await user.click(screen.getByRole("button", { name: "common.cancel" }));

    expect(spy.called).toBe(false);
    expect(visibilitySelect()).toHaveTextContent("resourceVisibility.privateStatus");
    expect(visibilitySelect()).toBeEnabled();
  });

  it("routes each resource type to its own publish endpoint", async () => {
    const user = userEvent.setup();
    const protocolSpy = server.mount(contract.protocols.setVisibility, {
      body: { id: "protocol-1", visibility: "public" },
    });

    renderControl({ resourceType: "protocol", resourceId: "protocol-1", visibility: "private" });

    await choose(user, "resourceVisibility.publicStatus");
    await user.click(
      screen.getByRole("button", { name: "resourceVisibility.publishConfirmButton" }),
    );

    await waitFor(() => expect(protocolSpy.called).toBe(true));
    expect(protocolSpy.params).toMatchObject({ id: "protocol-1" });
  });

  it("uses the workbook publish endpoint for workbooks", async () => {
    const user = userEvent.setup();
    const workbookSpy = server.mount(contract.workbooks.setVisibility, {
      body: { id: "wb-1", visibility: "public" },
    });

    renderControl({ resourceType: "workbook", resourceId: "wb-1", visibility: "private" });

    await choose(user, "resourceVisibility.publicStatus");
    await user.click(
      screen.getByRole("button", { name: "resourceVisibility.publishConfirmButton" }),
    );

    await waitFor(() => expect(workbookSpy.called).toBe(true));
    expect(workbookSpy.params).toMatchObject({ id: "wb-1" });
  });

  it("stays private and reports the failure when publishing is rejected", async () => {
    const user = userEvent.setup();
    server.mount(contract.macros.setVisibility, {
      status: 403,
      body: { message: "Forbidden" },
    });

    renderControl({ visibility: "private" });

    await choose(user, "resourceVisibility.publicStatus");
    await user.click(
      screen.getByRole("button", { name: "resourceVisibility.publishConfirmButton" }),
    );

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" })),
    );

    // A rejected publish leaves the dialog open, which `aria-hidden`s the page
    // behind it — dismiss it before reading the select back.
    await user.click(screen.getByRole("button", { name: "common.cancel" }));

    // No optimistic jump to "public".
    expect(visibilitySelect()).toHaveTextContent("resourceVisibility.privateStatus");
    expect(visibilitySelect()).toBeEnabled();
  });
});
