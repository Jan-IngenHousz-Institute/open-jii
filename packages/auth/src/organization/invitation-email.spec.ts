import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type * as Database from "@repo/database";

import { sendOrganizationInvitationEmail } from "../email/invitationEmail";
import { sendInvitationEmailUnlessAccountExists } from "./invitation-email";

vi.mock("../email/invitationEmail", () => ({
  sendOrganizationInvitationEmail: vi.fn().mockResolvedValue(undefined),
}));

/**
 * Only `db` is replaced: `users` and `sql` stay real, so the lookup under test is
 * the one that runs in production — down to the `lower()` comparison — and only the
 * rows it comes back with are ours to choose.
 */
const accounts: { id: string }[] = [];
vi.mock("@repo/database", async (importOriginal) => ({
  ...(await importOriginal<typeof Database>()),
  db: {
    select: () => ({
      from: () => ({ where: () => ({ limit: () => Promise.resolve(accounts) }) }),
    }),
  },
}));

const INVITE = {
  email: "invitee@example.com",
  role: "admin",
  organization: { name: "Photosynthesis Lab" },
  inviter: { user: { name: "Vlad Stoenescu", email: "vlad@example.com" } },
};

describe("who sends the organization invitation email", () => {
  beforeEach(() => {
    accounts.length = 0;
    vi.mocked(sendOrganizationInvitationEmail).mockClear();
    vi.stubEnv("AUTH_EMAIL_SERVER", "smtp://localhost:1025");
    vi.stubEnv("AUTH_EMAIL_FROM", "noreply@openjii.test");
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://openjii.test");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("emails an address with no openJII account", async () => {
    await sendInvitationEmailUnlessAccountExists(INVITE);

    expect(sendOrganizationInvitationEmail).toHaveBeenCalledExactlyOnceWith({
      to: "invitee@example.com",
      // The account tab, not a per-invitation route.
      inviteUrl: "https://openjii.test/platform/account/invitations",
      organizationName: "Photosynthesis Lab",
      inviterName: "Vlad Stoenescu",
      role: "admin",
      emailServer: "smtp://localhost:1025",
      emailFrom: "noreply@openjii.test",
      senderName: "openJII",
      baseUrl: "https://openjii.test",
    });
  });

  it("stands down for an address that already has an account", async () => {
    // The backend emails this one from notification dispatch instead, so that a
    // saved "Requests and invitations" preference governs it — and so that it
    // arrives once rather than twice.
    accounts.push({ id: "user-1" });

    await sendInvitationEmailUnlessAccountExists(INVITE);

    expect(sendOrganizationInvitationEmail).not.toHaveBeenCalled();
  });

  it("falls back to the inviter's address when they have no name", async () => {
    await sendInvitationEmailUnlessAccountExists({
      ...INVITE,
      inviter: { user: { name: "", email: "vlad@example.com" } },
    });

    expect(sendOrganizationInvitationEmail).toHaveBeenCalledWith(
      expect.objectContaining({ inviterName: "vlad@example.com" }),
    );
  });

  it("sends nothing when no mail server is configured", async () => {
    vi.stubEnv("AUTH_EMAIL_SERVER", "");

    await sendInvitationEmailUnlessAccountExists(INVITE);

    expect(sendOrganizationInvitationEmail).not.toHaveBeenCalled();
  });
});
