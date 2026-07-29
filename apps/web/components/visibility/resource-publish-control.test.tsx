import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import type { ComponentProps } from "react";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";

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

describe("<ResourcePublishControl />", () => {
  it("shows the private state with a publish action for a manager", () => {
    renderControl({ visibility: "private", canManage: true });

    expect(screen.getByText("resourceVisibility.privateStatus")).toBeInTheDocument();
    expect(screen.getByText("resourceVisibility.privateDescription")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "resourceVisibility.publishAction" }),
    ).toBeInTheDocument();
  });

  it("shows the private state without a publish action when the caller cannot manage", () => {
    renderControl({ visibility: "private", canManage: false });

    // The state is still legible — a viewer should know it is private — but
    // publishing is manage-gated, matching what the route enforces.
    expect(screen.getByText("resourceVisibility.privateStatus")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "resourceVisibility.publishAction" }),
    ).not.toBeInTheDocument();
  });

  it("shows a terminal public state with no controls, even for a manager", () => {
    renderControl({ visibility: "public", canManage: true });

    expect(screen.getByText("resourceVisibility.publicStatus")).toBeInTheDocument();
    expect(screen.getByText("resourceVisibility.publishedDescription")).toBeInTheDocument();
    // Visibility is monotonic: there is nothing to do once public.
    expect(
      screen.queryByRole("button", { name: "resourceVisibility.publishAction" }),
    ).not.toBeInTheDocument();
  });

  it("requires confirmation and then publishes, moving to the public state", async () => {
    const user = userEvent.setup();
    const spy = server.mount(contract.macros.setVisibility, {
      body: { id: "macro-1", visibility: "public" },
    });

    renderControl({ resourceType: "macro", resourceId: "macro-1", visibility: "private" });

    await user.click(screen.getByRole("button", { name: "resourceVisibility.publishAction" }));

    // Irreversible, so it is confirmed rather than fired on the first click.
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
      expect(screen.getByText("resourceVisibility.publishedDescription")).toBeInTheDocument(),
    );
    expect(
      screen.queryByRole("button", { name: "resourceVisibility.publishAction" }),
    ).not.toBeInTheDocument();
  });

  it("cancelling the confirmation publishes nothing", async () => {
    const user = userEvent.setup();
    const spy = server.mount(contract.macros.setVisibility, {
      body: { id: "macro-1", visibility: "public" },
    });

    renderControl({ visibility: "private" });

    await user.click(screen.getByRole("button", { name: "resourceVisibility.publishAction" }));
    await user.click(screen.getByRole("button", { name: "common.cancel" }));

    expect(spy.called).toBe(false);
    expect(screen.getByText("resourceVisibility.privateStatus")).toBeInTheDocument();
  });

  it("routes each resource type to its own publish endpoint", async () => {
    const user = userEvent.setup();
    const protocolSpy = server.mount(contract.protocols.setVisibility, {
      body: { id: "protocol-1", visibility: "public" },
    });

    renderControl({ resourceType: "protocol", resourceId: "protocol-1", visibility: "private" });

    await user.click(screen.getByRole("button", { name: "resourceVisibility.publishAction" }));
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

    await user.click(screen.getByRole("button", { name: "resourceVisibility.publishAction" }));
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

    await user.click(screen.getByRole("button", { name: "resourceVisibility.publishAction" }));
    await user.click(
      screen.getByRole("button", { name: "resourceVisibility.publishConfirmButton" }),
    );

    // No optimistic jump to "public" on a rejected publish.
    await waitFor(() =>
      expect(screen.getByText("resourceVisibility.privateStatus")).toBeInTheDocument(),
    );
    expect(screen.queryByText("resourceVisibility.publishedDescription")).not.toBeInTheDocument();
  });
});
