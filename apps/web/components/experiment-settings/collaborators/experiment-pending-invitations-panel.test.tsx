import { createInvitation } from "@/test/factories";
import { render, screen, within } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { ExperimentPendingInvitationsPanel } from "./experiment-pending-invitations-panel";

describe("ExperimentPendingInvitationsPanel", () => {
  it("distinguishes hidden invitations with safe inviter attribution and creation date", () => {
    render(
      <ExperimentPendingInvitationsPanel
        invitations={[
          createInvitation({
            id: "first",
            email: null,
            invitedByName: "Ada Owner",
            createdAt: "2026-10-12T10:00:00.000Z",
          }),
          createInvitation({
            id: "second",
            email: null,
            invitedByName: "Cora Admin",
            createdAt: "2026-10-13T10:00:00.000Z",
          }),
        ]}
        canRevoke
      />,
    );
    const rows = screen.getAllByRole("listitem");
    expect(within(rows[0]).getByText("Ada Owner")).toBeInTheDocument();
    expect(within(rows[1]).getByText("Cora Admin")).toBeInTheDocument();
    expect(rows[0].querySelector("time")).toHaveAttribute("dateTime", "2026-10-12T10:00:00.000Z");
    expect(rows[1].querySelector("time")).toHaveAttribute("dateTime", "2026-10-13T10:00:00.000Z");
    expect(rows.every((row) => !row.textContent.includes("@"))).toBe(true);
  });

  it("leaves out the inviter credit when the inviter has no name", () => {
    render(
      <ExperimentPendingInvitationsPanel
        invitations={[createInvitation({ id: "only", invitedByName: undefined })]}
        canRevoke
      />,
    );
    expect(screen.queryByText("experimentSettings.invitedBy")).not.toBeInTheDocument();
    expect(screen.getByRole("listitem").querySelector("time")).toBeInTheDocument();
  });

  it("keeps a safe reference when the same inviter sends several hidden invitations on one day", () => {
    render(
      <ExperimentPendingInvitationsPanel
        invitations={[
          createInvitation({
            id: "12345678-0000-4000-8000-000000000001",
            email: null,
            invitedByName: "Cora Manager",
          }),
          createInvitation({
            id: "87654321-0000-4000-8000-000000000002",
            email: null,
            invitedByName: "Cora Manager",
          }),
        ]}
        canRevoke
      />,
    );
    const rows = screen.getAllByRole("listitem");
    expect(within(rows[0]).getByText(/12345678/)).toHaveAttribute(
      "title",
      "12345678-0000-4000-8000-000000000001",
    );
    expect(within(rows[1]).getByText(/87654321/)).toHaveAttribute(
      "title",
      "87654321-0000-4000-8000-000000000002",
    );
    expect(rows[0].textContent).not.toBe(rows[1].textContent);
  });

  it("keeps a redacted invitation identifiable without an address or tooltip", () => {
    render(
      <ExperimentPendingInvitationsPanel
        invitations={[
          createInvitation({ id: "visible", email: "known@example.test" }),
          createInvitation({ id: "hidden", email: null }),
        ]}
        canRevoke
      />,
    );

    const rows = screen.getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText("known@example.test")).toHaveAttribute(
      "title",
      "known@example.test",
    );
    expect(within(rows[1]).getByText("experimentSettings.addressHidden")).not.toHaveAttribute(
      "title",
    );
    expect(within(rows[1]).getByText("experimentSettings.pendingInvite")).toBeInTheDocument();
    expect(
      within(rows[1]).getByRole("button", { name: /experimentSettings.revoke/ }),
    ).toBeEnabled();
  });
});
