import { render, screen } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import InvitationsPage from "./page";

vi.mock("~/components/account-settings/invitations/my-invitations-card", () => ({
  MyInvitationsCard: () => <div data-testid="my-invitations-card">Invitations</div>,
}));

describe("InvitationsPage", () => {
  it("renders the invitations card", () => {
    render(<InvitationsPage />);

    expect(screen.getByTestId("my-invitations-card")).toBeInTheDocument();
  });
});
