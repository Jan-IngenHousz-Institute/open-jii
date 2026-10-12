import { createInvitation } from "@/test/factories";
import { render, screen, within } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { ExperimentPendingInvitationsPanel } from "./experiment-pending-invitations-panel";

describe("ExperimentPendingInvitationsPanel", () => {
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
