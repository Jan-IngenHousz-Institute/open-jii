import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "~/test/test-utils";

import { authClient } from "@repo/auth/client";

import { AcceptInvitation } from "./accept-invitation";

const acceptInvitation = vi.mocked(authClient.organization.acceptInvitation);

describe("AcceptInvitation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("accepts the invitation by id and shows success", async () => {
    acceptInvitation.mockResolvedValue({ data: {}, error: null } as never);

    render(<AcceptInvitation invitationId="inv-1" locale="en-US" />);

    expect(await screen.findByText("You've joined the organization.")).toBeInTheDocument();
    expect(acceptInvitation).toHaveBeenCalledWith({ invitationId: "inv-1" });
  });

  it("shows the error message when acceptance fails", async () => {
    acceptInvitation.mockResolvedValue({
      data: null,
      error: { message: "Invitation expired" },
    } as never);

    render(<AcceptInvitation invitationId="inv-2" locale="en-US" />);

    expect(await screen.findByText("Invitation expired")).toBeInTheDocument();
  });
});
