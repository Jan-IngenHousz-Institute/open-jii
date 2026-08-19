import { eq, organizationInvitations } from "@repo/database";

import { TestHarness } from "../test/test-harness";
import { OrganizationJoinRequestRepository } from "./core/repositories/organization-join-request.repository";

/**
 * What an admission does to the invitations already out for the same person.
 *
 * A pending invitation is a standing offer to admit somebody. Once they are in by
 * another route, the offers that add nothing have been answered and should stop being
 * claimable — they would otherwise hold slots against `invitationLimit` and sit on the
 * Invited tab beside the member they already made.
 *
 * Driven through join-request approval, which is the only admission openJII writes
 * itself: accepting an invitation is Better Auth's own endpoint, and the requester here
 * asked to join, so nothing is waiting on their consent.
 */
describe("invitations an admission has answered", () => {
  const testApp = TestHarness.App;
  let joinRequests: OrganizationJoinRequestRepository;
  let inviterId: string;
  let inviteeId: string;
  let organizationId: string;

  const INVITEE_EMAIL = "invitee@example.com";

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    joinRequests = testApp.module.get(OrganizationJoinRequestRepository);
    inviterId = await testApp.createTestUser({ email: "inviter@example.com" });
    inviteeId = await testApp.createTestUser({ email: INVITEE_EMAIL });
    organizationId = await testApp.createOrganization("Photosynthesis Lab");
    await testApp.addOrganizationMember(organizationId, inviterId, "owner");
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  /** Approve a fresh join request from the invitee — the admission under test. */
  async function approveJoinRequest() {
    const request = await testApp.addOrganizationJoinRequest(organizationId, inviteeId);
    return joinRequests.approve(request.id, inviteeId, organizationId, inviterId);
  }

  const statusOf = (invitationId: string) =>
    testApp.database
      .select({ status: organizationInvitations.status })
      .from(organizationInvitations)
      .where(eq(organizationInvitations.id, invitationId))
      .then((rows) => rows[0]?.status);

  it("closes the matching invitation when the person is admitted another way", async () => {
    const invitation = await testApp.addOrganizationInvitation({
      organizationId,
      email: INVITEE_EMAIL,
      inviterId,
      role: "member",
    });

    const approved = await approveJoinRequest();

    expect(approved.isSuccess() && approved.value.outcome).toBe("approved");
    expect(await statusOf(invitation.id)).toBe("accepted");
  });

  it("closes it when they were already a member", async () => {
    await testApp.addOrganizationMember(organizationId, inviteeId, "member");
    const invitation = await testApp.addOrganizationInvitation({
      organizationId,
      email: INVITEE_EMAIL,
      inviterId,
      role: "member",
    });

    const approved = await approveJoinRequest();

    // Nothing was admitted, but the offer is just as answered: they are in the
    // organization it names.
    expect(approved.isSuccess() && approved.value.outcome).toBe("approved");
    expect(await statusOf(invitation.id)).toBe("accepted");
  });

  it("leaves an invitation offering more than they were given", async () => {
    const invitation = await testApp.addOrganizationInvitation({
      organizationId,
      email: INVITEE_EMAIL,
      inviterId,
      role: "owner",
    });

    await approveJoinRequest();

    // Being admitted as a member is not an answer to an offer of ownership, and the
    // accept page is where that promotion is deliberately claimed.
    expect(await statusOf(invitation.id)).toBe("pending");
  });

  it("leaves another organization's invitation alone", async () => {
    const otherOrganizationId = await testApp.createOrganization("Chlorophyll Lab");
    await testApp.addOrganizationMember(otherOrganizationId, inviterId, "owner");
    const elsewhere = await testApp.addOrganizationInvitation({
      organizationId: otherOrganizationId,
      email: INVITEE_EMAIL,
      inviterId,
      role: "member",
    });

    await approveJoinRequest();

    expect(await statusOf(elsewhere.id)).toBe("pending");
  });

  it("leaves an invitation for somebody else alone", async () => {
    const someoneElse = await testApp.addOrganizationInvitation({
      organizationId,
      email: `other-${crypto.randomUUID()}@example.com`,
      inviterId,
      role: "member",
    });

    await approveJoinRequest();

    expect(await statusOf(someoneElse.id)).toBe("pending");
  });
});
