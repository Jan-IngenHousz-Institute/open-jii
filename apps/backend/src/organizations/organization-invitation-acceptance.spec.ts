import { and, eq, organizationInvitations, organizationMembers, teamMembers } from "@repo/database";

import { AppError, failure } from "../common/utils/fp-utils";
import { TestHarness } from "../test/test-harness";
import { AcceptPendingOrganizationInvitationsUseCase } from "./application/use-cases/accept-pending-organization-invitations/accept-pending-organization-invitations";
import { OrganizationInvitationRepository } from "./core/repositories/organization-invitation.repository";

/**
 * Sign-in auto-accept for Better Auth organization invitations: the direct
 * transaction the organization auth hook runs on every sign-in.
 */
describe("organization invitation auto-acceptance", () => {
  const testApp = TestHarness.App;
  let useCase: AcceptPendingOrganizationInvitationsUseCase;
  let repository: OrganizationInvitationRepository;
  let inviterId: string;
  let inviteeId: string;
  let organizationId: string;

  const INVITEE_EMAIL = "invitee@example.com";

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    useCase = testApp.module.get(AcceptPendingOrganizationInvitationsUseCase);
    repository = testApp.module.get(OrganizationInvitationRepository);
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

  function membershipRows(userId: string) {
    return testApp.database
      .select({ role: organizationMembers.role })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, organizationId),
          eq(organizationMembers.userId, userId),
        ),
      );
  }

  function invitationStatus(invitationId: string) {
    return testApp.database
      .select({ status: organizationInvitations.status })
      .from(organizationInvitations)
      .where(eq(organizationInvitations.id, invitationId));
  }

  it("admits the invitee with the invited role and closes the invitation", async () => {
    const invitation = await testApp.addOrganizationInvitation({
      organizationId,
      email: INVITEE_EMAIL,
      inviterId,
      role: "admin",
    });

    const result = await useCase.execute(inviteeId, INVITEE_EMAIL);

    expect(result.isSuccess() && result.value).toBe(1);
    expect(await membershipRows(inviteeId)).toEqual([{ role: "admin" }]);
    expect(await invitationStatus(invitation.id)).toEqual([{ status: "accepted" }]);
  });

  it("treats a role-less invitation as a plain member", async () => {
    await testApp.addOrganizationInvitation({
      organizationId,
      email: INVITEE_EMAIL,
      inviterId,
      role: null,
    });

    await useCase.execute(inviteeId, INVITEE_EMAIL);

    expect(await membershipRows(inviteeId)).toEqual([{ role: "member" }]);
  });

  it("places the invitee on the team the invitation names", async () => {
    const teamId = await testApp.createTeam(organizationId, "Field crew");
    await testApp.addOrganizationInvitation({
      organizationId,
      email: INVITEE_EMAIL,
      inviterId,
      teamId,
    });

    await useCase.execute(inviteeId, INVITEE_EMAIL);

    const teamRows = await testApp.database
      .select({ userId: teamMembers.userId })
      .from(teamMembers)
      .where(eq(teamMembers.teamId, teamId));
    expect(teamRows).toEqual([{ userId: inviteeId }]);
  });

  it("refuses an expired invitation, leaving it untouched", async () => {
    const invitation = await testApp.addOrganizationInvitation({
      organizationId,
      email: INVITEE_EMAIL,
      inviterId,
      expiresAt: new Date(Date.now() - 60 * 1000),
    });

    const result = await useCase.execute(inviteeId, INVITEE_EMAIL);

    expect(result.isSuccess() && result.value).toBe(0);
    expect(await membershipRows(inviteeId)).toEqual([]);
    expect(await invitationStatus(invitation.id)).toEqual([{ status: "pending" }]);
  });

  it("refuses an invitation that expires between the lookup and the claim", async () => {
    const invitation = await testApp.addOrganizationInvitation({
      organizationId,
      email: INVITEE_EMAIL,
      inviterId,
    });
    // The lookup filter would have excluded this row; calling the claim directly is
    // the same position the use-case is in when a live invitation lapses mid-run.
    await testApp.database
      .update(organizationInvitations)
      .set({ expiresAt: new Date(Date.now() - 60 * 1000) })
      .where(eq(organizationInvitations.id, invitation.id));

    const result = await repository.accept(invitation.id, inviteeId);

    expect(result.isSuccess() && result.value).toBe("not-pending");
    expect(await membershipRows(inviteeId)).toEqual([]);
    expect(await invitationStatus(invitation.id)).toEqual([{ status: "pending" }]);
  });

  it("is idempotent for somebody who is already a member, keeping their role", async () => {
    await testApp.addOrganizationMember(organizationId, inviteeId, "owner");
    const invitation = await testApp.addOrganizationInvitation({
      organizationId,
      email: INVITEE_EMAIL,
      inviterId,
      role: "member",
    });

    await useCase.execute(inviteeId, INVITEE_EMAIL);

    expect(await membershipRows(inviteeId)).toEqual([{ role: "owner" }]);
    expect(await invitationStatus(invitation.id)).toEqual([{ status: "accepted" }]);
  });

  it("ignores an invitation that is no longer pending", async () => {
    await testApp.addOrganizationInvitation({
      organizationId,
      email: INVITEE_EMAIL,
      inviterId,
      status: "canceled",
    });

    const result = await useCase.execute(inviteeId, INVITEE_EMAIL);

    expect(result.isSuccess() && result.value).toBe(0);
    expect(await membershipRows(inviteeId)).toEqual([]);
  });

  it("heals: a failed acceptance is retried on the next sign-in", async () => {
    await testApp.addOrganizationInvitation({
      organizationId,
      email: INVITEE_EMAIL,
      inviterId,
    });

    const accept = vi
      .spyOn(repository, "accept")
      .mockResolvedValueOnce(failure(AppError.internal("transient")));

    const firstSignIn = await useCase.execute(inviteeId, INVITEE_EMAIL);
    expect(firstSignIn.isSuccess() && firstSignIn.value).toBe(0);
    expect(await membershipRows(inviteeId)).toEqual([]);

    accept.mockRestore();

    const secondSignIn = await useCase.execute(inviteeId, INVITEE_EMAIL);
    expect(secondSignIn.isSuccess() && secondSignIn.value).toBe(1);
    expect(await membershipRows(inviteeId)).toEqual([{ role: "member" }]);
  });

  it("matches the invited address case-insensitively", async () => {
    await testApp.addOrganizationInvitation({
      organizationId,
      email: INVITEE_EMAIL,
      inviterId,
    });

    await useCase.execute(inviteeId, "Invitee@Example.com");

    expect(await membershipRows(inviteeId)).toEqual([{ role: "member" }]);
  });
});
