import { StatusCodes } from "http-status-codes";

import { isGranteeRow } from "@repo/api/domains/sharing/sharing.schema";
import { eq, macros, organizations, organizationMembers, profiles } from "@repo/database";

import { assertFailure, assertSuccess } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { CreateGrantUseCase } from "../create-grant/create-grant";
import { ListGrantsUseCase } from "./list-grants";

describe("listGrants", () => {
  const testApp = TestHarness.App;
  let listGrants: ListGrantsUseCase;
  let createGrant: CreateGrantUseCase;
  let owner: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    listGrants = testApp.module.get(ListGrantsUseCase);
    createGrant = testApp.module.get(CreateGrantUseCase);
    owner = await testApp.createTestUser({ name: "Owner" });
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  async function makeSharedOrg() {
    const [org] = await testApp.database
      .insert(organizations)
      .values({ name: `Org ${crypto.randomUUID()}`, slug: `org-${crypto.randomUUID()}` })
      .returning();
    return org.id;
  }

  it("allows the owning-org owner and returns the direct grants", async () => {
    const macro = await testApp.createMacro({ name: "M", createdBy: owner });
    const outsider = await testApp.createTestUser({ name: "Outsider" });
    assertSuccess(
      await createGrant.execute(owner, "macro", macro.id, {
        granteeType: "user",
        granteeId: outsider,
        role: "viewer",
      }),
    );

    const result = await listGrants.execute(owner, "macro", macro.id);
    assertSuccess(result);
    // The owner is synthesized from the owning org, not read from a grant; the
    // outsider is the only actual grant row.
    expect(
      result.value.flatMap((row) => (isGranteeRow(row) ? [[row.kind, row.granteeId]] : [])),
    ).toEqual([
      ["owner", owner],
      ["grant", outsider],
    ]);
  });

  describe("synthesized owner rows", () => {
    it("lists the owner first, with no grant id or role to act on", async () => {
      const macro = await testApp.createMacro({ name: "M", createdBy: owner });

      const result = await listGrants.execute(owner, "macro", macro.id);
      assertSuccess(result);

      // A macro nobody has been given still has somebody on its collaborators
      // surface: the person who owns it. Under a grants-only list it would look
      // ownerless.
      expect(result.value).toEqual([
        expect.objectContaining({
          kind: "owner",
          granteeType: "user",
          granteeId: owner,
        }),
      ]);
      // No grant id and no role: there is nothing on an owner row to act on.
      expect(result.value[0]).not.toHaveProperty("id");
      expect(result.value[0]).not.toHaveProperty("role");
    });

    it("shows an owner who also holds a grant exactly once, as the owner", async () => {
      const macro = await testApp.createMacro({ name: "M", createdBy: owner });
      await testApp.addResourceGrant({
        resourceType: "macro",
        resourceId: macro.id,
        granteeType: "user",
        granteeId: owner,
        role: "admin",
      });

      const result = await listGrants.execute(owner, "macro", macro.id);
      assertSuccess(result);

      // The grant repeats access the org role already gives, so rendering both
      // would put one person on two rows with contradictory affordances.
      expect(result.value).toHaveLength(1);
      expect(result.value[0].kind).toBe("owner");
    });

    it("omits an owner whose account has been closed", async () => {
      const macro = await testApp.createMacro({ name: "M", createdBy: owner });
      const keeper = await testApp.createTestUser({ name: "Keeper" });
      await testApp.addResourceAdmin("macro", macro.id, keeper);
      await testApp.database
        .update(profiles)
        .set({ deletedAt: new Date() })
        .where(eq(profiles.userId, owner));

      const result = await listGrants.execute(keeper, "macro", macro.id);
      assertSuccess(result);

      // A closed account is nobody to escalate to, so it is not offered as the
      // resource's owner.
      expect(
        result.value.flatMap((row) => (isGranteeRow(row) ? [[row.kind, row.granteeId]] : [])),
      ).toEqual([["grant", keeper]]);
    });
  });

  describe("synthesized organization rows", () => {
    /** A macro owned by an org the caller owns, so `share` is allowed. */
    async function ownedMacro() {
      const org = await testApp.createOrganization("Greenhouse Lab");
      await testApp.addOrganizationMember(org, owner, "owner");
      const macro = await testApp.createMacro({ name: "M", createdBy: owner, organizationId: org });
      return { org, macro };
    }

    it("counts admins and members as one row each, with owners still named", async () => {
      const { org, macro } = await ownedMacro();
      for (const name of ["Admin One", "Admin Two"]) {
        await testApp.addOrganizationMember(org, await testApp.createTestUser({ name }), "admin");
      }
      await testApp.addOrganizationMember(
        org,
        await testApp.createTestUser({ name: "Plain Member" }),
        "member",
      );

      const result = await listGrants.execute(owner, "macro", macro.id);
      assertSuccess(result);

      expect(result.value.map((row) => row.kind)).toEqual(["owner", "orgAdmins", "orgMembers"]);
      expect(result.value[1]).toMatchObject({ adminCount: 2, organizationName: "Greenhouse Lab" });
      expect(result.value[2]).toMatchObject({ memberCount: 1 });
    });

    it("reads a comma-joined `member,owner` as an owner, counted in neither summary", async () => {
      const { org, macro } = await ownedMacro();
      const both = await testApp.createTestUser({ name: "Both Roles" });
      await testApp.addOrganizationMember(org, both, "member,owner" as "owner");

      const result = await listGrants.execute(owner, "macro", macro.id);
      assertSuccess(result);

      // The precedence `can()` applies: they hold owner, so they are named rather
      // than counted, and neither summary may claim them a second time.
      expect(result.value.flatMap((row) => (row.kind === "owner" ? [row.granteeId] : []))).toEqual(
        expect.arrayContaining([both]),
      );
      expect(result.value.some((row) => row.kind === "orgAdmins")).toBe(false);
      expect(result.value.some((row) => row.kind === "orgMembers")).toBe(false);
    });

    it("breaks a grant holder out of the summary rather than counting them twice", async () => {
      const { org, macro } = await ownedMacro();
      const plain = await testApp.createTestUser({ name: "Ada Admin" });
      const granted = await testApp.createTestUser({ name: "Bo Staleadmin" });
      await testApp.addOrganizationMember(org, plain, "admin");
      await testApp.addOrganizationMember(org, granted, "admin");
      await testApp.addResourceGrant({
        resourceType: "macro",
        resourceId: macro.id,
        granteeType: "user",
        granteeId: granted,
        role: "viewer",
      });

      const result = await listGrants.execute(owner, "macro", macro.id);
      assertSuccess(result);

      // Two admins, but only the one with nothing explicit is a count; the other has
      // a row of their own, and counting them in both places would make the roster
      // add up to more collaborators than there are.
      expect(result.value.find((row) => row.kind === "orgAdmins")).toMatchObject({ adminCount: 1 });
      expect(result.value.find((row) => row.kind === "grant")).toMatchObject({
        granteeId: granted,
        owningOrganization: { role: "admin", name: "Greenhouse Lab" },
      });
    });

    it("breaks a member with a grant out of the members summary too", async () => {
      const { org, macro } = await ownedMacro();
      const plain = await testApp.createTestUser({ name: "Mira Member" });
      const raised = await testApp.createTestUser({ name: "Rex Raised" });
      await testApp.addOrganizationMember(org, plain, "member");
      await testApp.addOrganizationMember(org, raised, "member");
      await testApp.addResourceGrant({
        resourceType: "macro",
        resourceId: macro.id,
        granteeType: "user",
        granteeId: raised,
        role: "admin",
      });

      const result = await listGrants.execute(owner, "macro", macro.id);
      assertSuccess(result);

      expect(result.value.find((row) => row.kind === "orgMembers")).toMatchObject({
        memberCount: 1,
      });
      // Their role is on the row, which is how it can state both sources of access.
      expect(result.value.find((row) => row.kind === "grant")).toMatchObject({
        granteeId: raised,
        owningOrganization: { role: "member" },
      });
    });

    it("leaves no organization on the row of a grantee outside the owning org", async () => {
      const { macro } = await ownedMacro();
      const outsider = await testApp.createTestUser({ name: "Otto Outside" });
      await testApp.addResourceGrant({
        resourceType: "macro",
        resourceId: macro.id,
        granteeType: "user",
        granteeId: outsider,
        role: "admin",
      });

      const result = await listGrants.execute(owner, "macro", macro.id);
      assertSuccess(result);

      expect(result.value.find((row) => row.kind === "grant")).toMatchObject({
        granteeId: outsider,
        owningOrganization: null,
        isOutsideCollaborator: true,
      });
    });

    it("does not count a member whose role token nothing recognises", async () => {
      const { org, macro } = await ownedMacro();
      const stranger = await testApp.createTestUser({ name: "Odd Role" });
      await testApp.addOrganizationMember(org, stranger, "guest" as "member");

      const result = await listGrants.execute(owner, "macro", macro.id);
      assertSuccess(result);

      // `orgRoleCan` ignores a token it does not know, so this person holds nothing
      // through the organization. Counting them as a plain member — which negating
      // full-control does — would credit them with read access they do not have.
      expect(result.value.some((row) => row.kind === "orgMembers")).toBe(false);
    });

    it("omits an admin whose account has been closed", async () => {
      const { org, macro } = await ownedMacro();
      const gone = await testApp.createTestUser({ name: "Gone Admin" });
      await testApp.addOrganizationMember(org, gone, "admin");
      await testApp.database
        .update(profiles)
        .set({ deletedAt: new Date() })
        .where(eq(profiles.userId, gone));

      const result = await listGrants.execute(owner, "macro", macro.id);
      assertSuccess(result);

      // An empty summary would claim a group of administrators that is not there.
      expect(result.value.some((row) => row.kind === "orgAdmins")).toBe(false);
    });
  });

  it("denies a viewer-grant holder (no collaborator enumeration)", async () => {
    const macro = await testApp.createMacro({ name: "M", createdBy: owner });
    const viewer = await testApp.createTestUser({ name: "Viewer" });
    await testApp.addResourceGrant({
      resourceType: "macro",
      resourceId: macro.id,
      granteeType: "user",
      granteeId: viewer,
      role: "viewer",
    });

    const result = await listGrants.execute(viewer, "macro", macro.id);
    assertFailure(result);
    expect(result.error.statusCode).toBe(StatusCodes.FORBIDDEN);
  });

  it("denies a plain public-read viewer (public resource, no grant)", async () => {
    const macro = await testApp.createMacro({ name: "M", createdBy: owner }); // public by default
    const reader = await testApp.createTestUser({ name: "Reader" });

    const result = await listGrants.execute(reader, "macro", macro.id);
    assertFailure(result);
    expect(result.error.statusCode).toBe(StatusCodes.FORBIDDEN);
  });

  it("marks a user grantee in the owning org as not an outside collaborator", async () => {
    const orgId = await makeSharedOrg();
    await testApp.database
      .insert(organizationMembers)
      .values({ organizationId: orgId, userId: owner, role: "owner" });
    const member = await testApp.createTestUser({ name: "Member" });
    await testApp.database
      .insert(organizationMembers)
      .values({ organizationId: orgId, userId: member, role: "member" });
    // Macro owned by the shared org.
    const macro = await testApp.createMacro({ name: "M", createdBy: owner });
    await testApp.database
      .update(macros)
      .set({ organizationId: orgId })
      .where(eq(macros.id, macro.id));

    assertSuccess(
      await createGrant.execute(owner, "macro", macro.id, {
        granteeType: "user",
        granteeId: member,
        role: "viewer",
      }),
    );
    const result = await listGrants.execute(owner, "macro", macro.id);
    assertSuccess(result);
    const grant = result.value.find(
      (g): g is Extract<typeof g, { kind: "grant" }> =>
        g.kind === "grant" && g.granteeId === member,
    );
    expect(grant?.isOutsideCollaborator).toBe(false);
  });

  it("marks an organization grantee other than the owning org as an outside collaborator", async () => {
    const macro = await testApp.createMacro({ name: "M", createdBy: owner });
    // A shared org the sharer belongs to (grantees must be selectable in the
    // picker) but which does NOT own the macro — the outside-collaborator case.
    const otherOrg = await makeSharedOrg();
    await testApp.database
      .insert(organizationMembers)
      .values({ organizationId: otherOrg, userId: owner, role: "member" });

    assertSuccess(
      await createGrant.execute(owner, "macro", macro.id, {
        granteeType: "organization",
        granteeId: otherOrg,
        role: "viewer",
      }),
    );
    const result = await listGrants.execute(owner, "macro", macro.id);
    assertSuccess(result);
    const grant = result.value.find(
      (g): g is Extract<typeof g, { kind: "grant" }> =>
        g.kind === "grant" && g.granteeId === otherOrg,
    );
    expect(grant?.granteeType).toBe("organization");
    expect(grant?.isOutsideCollaborator).toBe(true);
  });
});
