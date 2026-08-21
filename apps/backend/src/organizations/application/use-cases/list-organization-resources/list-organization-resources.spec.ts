import { vi } from "vitest";

import type { DatabaseInstance } from "@repo/database";

import { assertSuccess } from "../../../../common/utils/fp-utils";
import { CreateIotDeviceGroupUseCase } from "../../../../iot/application/use-cases/create-iot-device-group/create-iot-device-group";
import { IotDeviceGroupRepository } from "../../../../iot/core/repositories/iot-device-group.repository";
import { ListGrantsUseCase } from "../../../../sharing/application/use-cases/list-grants/list-grants";
import { SharingRepository } from "../../../../sharing/core/repositories/sharing.repository";
import { TestHarness } from "../../../../test/test-harness";
import { ListOrganizationResourcesUseCase } from "./list-organization-resources";

describe("listOrganizationResources", () => {
  const testApp = TestHarness.App;
  let listResources: ListOrganizationResourcesUseCase;
  let listGrants: ListGrantsUseCase;
  let createGroup: CreateIotDeviceGroupUseCase;
  let groupRepository: IotDeviceGroupRepository;
  let sharingRepository: SharingRepository;
  let owner: string;
  let member: string;
  let organizationId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    listResources = testApp.module.get(ListOrganizationResourcesUseCase);
    listGrants = testApp.module.get(ListGrantsUseCase);
    createGroup = testApp.module.get(CreateIotDeviceGroupUseCase);
    groupRepository = testApp.module.get(IotDeviceGroupRepository);
    sharingRepository = testApp.module.get(SharingRepository);

    owner = await testApp.createTestUser({ name: "Olive Owner" });
    member = await testApp.createTestUser({ name: "Mel Member" });
    organizationId = await testApp.createOrganization("Photosynthesis Lab", {
      visibility: "public",
    });
    await testApp.addOrganizationMember(organizationId, owner, "owner");
    await testApp.addOrganizationMember(organizationId, member, "member");
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  /** The row the showcase returned for a given resource id. */
  async function showcaseRow(userId: string, resourceId: string) {
    const result = await listResources.execute(organizationId, userId);
    assertSuccess(result);
    const row = result.value.resources.find((resource) => resource.id === resourceId);
    if (!row) throw new Error(`No showcase row for ${resourceId}`);
    return row;
  }

  /**
   * **The count agreement.** A card saying "7" next to a tab listing four is the whole
   * failure mode, so the number is asserted against the collaborators surface itself
   * rather than against an expected integer — the two cannot drift apart without this
   * failing, whichever of them changes.
   */
  describe("collaborator counts agree with the collaborators surface", () => {
    async function expectAgreement(
      resourceType: "macro" | "workbook" | "device_group",
      resourceId: string,
    ) {
      const grants = await listGrants.execute(owner, resourceType, resourceId);
      assertSuccess(grants);
      const row = await showcaseRow(owner, resourceId);

      expect(row.collaboratorCount).toBe(grants.value.length);
      return row.collaboratorCount;
    }

    it("counts the owning organization's owner on a resource nobody was granted", async () => {
      const macro = await testApp.createMacro({
        name: "Batch fit",
        createdBy: owner,
        organizationId,
      });

      // The owner, plus the summary row standing in for the organization's one plain
      // member: the creator holds no grant on what they create, so a count read off
      // `resource_grants` alone would say zero here.
      expect(await expectAgreement("macro", macro.id)).toBe(2);
    });

    it("counts a user grant alongside the owner", async () => {
      const outsider = await testApp.createTestUser({ name: "Otto Outsider" });
      const macro = await testApp.createMacro({
        name: "NPQ fit",
        createdBy: owner,
        organizationId,
      });
      await testApp.addResourceGrant({
        resourceType: "macro",
        resourceId: macro.id,
        granteeType: "user",
        granteeId: outsider,
        role: "viewer",
        createdBy: owner,
      });

      expect(await expectAgreement("macro", macro.id)).toBe(3);
    });

    it("counts a team grantee once, not once per member of the team", async () => {
      const workbook = await testApp.createWorkbook({
        name: "Canopy synthesis",
        createdBy: owner,
        organizationId,
      });
      const teamId = await testApp.createTeam(organizationId, "Field crew");
      await testApp.addTeamMember(teamId, owner);
      await testApp.addTeamMember(teamId, member);
      await testApp.addResourceGrant({
        resourceType: "workbook",
        resourceId: workbook.id,
        granteeType: "team",
        granteeId: teamId,
        role: "viewer",
        createdBy: owner,
      });

      // The collaborators surface lists the team as one row carrying its head count,
      // so expanding it to two people here would overstate the resource by one.
      expect(await expectAgreement("workbook", workbook.id)).toBe(3);
    });

    it("counts an owner who also holds a grant once", async () => {
      const macro = await testApp.createMacro({
        name: "Drift fix",
        createdBy: owner,
        organizationId,
      });
      await testApp.addResourceGrant({
        resourceType: "macro",
        resourceId: macro.id,
        granteeType: "user",
        granteeId: owner,
        role: "admin",
        createdBy: owner,
      });

      // The surface shows them once, as the owner; two rows for one person would carry
      // contradictory affordances, and two in the count would be a phantom collaborator.
      expect(await expectAgreement("macro", macro.id)).toBe(2);
    });

    it("does not double-count somebody a grant broke out of a summary", async () => {
      const macro = await testApp.createMacro({
        name: "Break out",
        createdBy: owner,
        organizationId,
      });
      // The organization's only plain member, granted a tier that raises them: they
      // leave the members summary for a row of their own, and the now-empty summary
      // stops being a row at all.
      await testApp.addResourceGrant({
        resourceType: "macro",
        resourceId: macro.id,
        granteeType: "user",
        granteeId: member,
        role: "admin",
        createdBy: owner,
      });

      expect(await expectAgreement("macro", macro.id)).toBe(2);
    });

    it("keeps counting a summary that still has somebody left in it", async () => {
      const macro = await testApp.createMacro({
        name: "Partly broken out",
        createdBy: owner,
        organizationId,
      });
      const second = await testApp.createTestUser({ name: "Mira Member" });
      await testApp.addOrganizationMember(organizationId, second, "member");
      await testApp.addResourceGrant({
        resourceType: "macro",
        resourceId: macro.id,
        granteeType: "user",
        granteeId: member,
        role: "admin",
        createdBy: owner,
      });

      // Owner, the broken-out member's own row, and a members summary still standing
      // for the one who holds nothing explicit.
      expect(await expectAgreement("macro", macro.id)).toBe(3);
    });

    it("counts the admins summary, and drops it when a grant empties it", async () => {
      const admin = await testApp.createTestUser({ name: "Ada Admin" });
      await testApp.addOrganizationMember(organizationId, admin, "admin");
      const macro = await testApp.createMacro({
        name: "Admin summary",
        createdBy: owner,
        organizationId,
      });

      // Owner, admins summary, members summary.
      expect(await expectAgreement("macro", macro.id)).toBe(3);

      await testApp.addResourceGrant({
        resourceType: "macro",
        resourceId: macro.id,
        granteeType: "user",
        granteeId: admin,
        role: "viewer",
        createdBy: owner,
      });

      // The admin's redundant grant moves them onto their own row, so the summary
      // goes and the total is unchanged rather than incremented.
      expect(await expectAgreement("macro", macro.id)).toBe(3);
    });

    /**
     * The count is keyed by resource type, and a type the key builder does not reach
     * reports zero for every one of its rows — which reads as "nobody has this" rather
     * than as a bug. So a group is checked against the collaborators surface too, and
     * against a number that is not zero.
     */
    it("counts a device group's collaborators like any other resource", async () => {
      const created = await createGroup.execute({ name: "Rooftop array", organizationId }, owner);
      assertSuccess(created);
      const outsider = await testApp.createTestUser({ name: "Otto Outsider" });
      await testApp.addResourceGrant({
        resourceType: "device_group",
        resourceId: created.value.id,
        granteeType: "user",
        granteeId: outsider,
        role: "viewer",
        createdBy: owner,
      });

      // Owner, the members summary, and the outsider's own row.
      expect(await expectAgreement("device_group", created.value.id)).toBe(3);
    });
  });

  describe("device group rows", () => {
    it("carries the roster size the group list already reads", async () => {
      const created = await createGroup.execute({ name: "Field array", organizationId }, owner);
      assertSuccess(created);
      const first = await testApp.createIotDevice({ createdBy: owner, organizationId });
      const second = await testApp.createIotDevice({ createdBy: owner, organizationId });
      const added = await groupRepository.addMembers(
        created.value.id,
        [first.id, second.id],
        owner,
      );
      assertSuccess(added);

      const row = await showcaseRow(owner, created.value.id);

      expect(row.type).toBe("device_group");
      // Two devices, not the two-member group's zero: the count rides on the row the
      // list already selected, so a projection that dropped it would read as empty.
      expect(row).toMatchObject({ type: "device_group", memberCount: 2 });
    });

    it("counts groups into the totals and leaves another organization's out", async () => {
      const elsewhere = await testApp.createOrganization("Somewhere Else", {
        visibility: "public",
      });
      await testApp.addOrganizationMember(elsewhere, owner, "owner");
      const ours = await createGroup.execute({ name: "Ours", organizationId }, owner);
      assertSuccess(ours);
      const theirs = await createGroup.execute(
        { name: "Theirs", organizationId: elsewhere },
        owner,
      );
      assertSuccess(theirs);

      const result = await listResources.execute(organizationId, owner);
      assertSuccess(result);

      // The caller created both and can read both, so only the organization filter
      // keeps the other one off this page.
      expect(result.value.resources.map((row) => row.id)).toEqual([ours.value.id]);
      expect(result.value.totals.device_group).toBe(1);
    });

    it("shows a non-member none of them, groups being permanently private", async () => {
      const created = await createGroup.execute({ name: "Private array", organizationId }, owner);
      assertSuccess(created);
      const outsider = await testApp.createTestUser({ name: "Nina Nonmember" });

      const result = await listResources.execute(organizationId, outsider);
      assertSuccess(result);

      expect(result.value.resources).toEqual([]);
      expect(result.value.totals.device_group).toBe(0);
      // Not vacuous: the group is there, and the organization's own owner sees it.
      const asOwner = await showcaseRow(owner, created.value.id);
      expect(asOwner.id).toBe(created.value.id);
    });
  });

  describe("a fixed number of reads for the whole page", () => {
    /**
     * One resource of every showcased type per round, so the page spans all of them —
     * hardware included. A seed that stopped at the four authored types would leave the
     * single-call assertion below true of only part of the page.
     */
    const SHOWCASED_TYPES = 6;

    async function seedOneOfEveryType(count: number) {
      for (let index = 0; index < count; index++) {
        const { experiment } = await testApp.createExperiment({
          name: `Experiment ${index}`,
          userId: owner,
          visibility: "public",
        });
        await testApp.database.execute(
          `UPDATE experiments SET organization_id = '${organizationId}' WHERE id = '${experiment.id}'`,
        );
        await testApp.createProtocol({
          name: `Protocol ${index}`,
          createdBy: owner,
          organizationId,
        });
        await testApp.createMacro({ name: `Macro ${index}`, createdBy: owner, organizationId });
        await testApp.createWorkbook({
          name: `Workbook ${index}`,
          createdBy: owner,
          organizationId,
        });
        await testApp.createIotDevice({ createdBy: owner, organizationId });
        const group = await createGroup.execute({ name: `Group ${index}`, organizationId }, owner);
        assertSuccess(group);
      }
    }

    it("asks for every resource's count in a single call", async () => {
      await seedOneOfEveryType(3);
      const countCollaborators = vi.spyOn(sharingRepository, "countCollaborators");

      const result = await listResources.execute(organizationId, owner);
      assertSuccess(result);

      // A loop over the rows would be eighteen calls on an organization this small, and
      // the showcase is uncapped — so the shape of the read, not its cost here, is
      // what this pins down.
      expect(countCollaborators).toHaveBeenCalledTimes(1);
      const [, asked] = countCollaborators.mock.calls[0];
      expect(asked).toHaveLength(3 * SHOWCASED_TYPES);
      // Every type is in that one call, not just the four that carry an author.
      expect(new Set(asked.map((row) => row.resourceType)).size).toBe(SHOWCASED_TYPES);
      expect(new Set(asked.map((row) => row.resourceId))).toEqual(
        new Set(result.value.resources.map((row) => row.id)),
      );
    });

    it("issues the same number of statements whatever the resource count is", async () => {
      await seedOneOfEveryType(3);
      const rows = await listResources.execute(organizationId, owner);
      assertSuccess(rows);
      const asked = rows.value.resources.map((row) => ({
        resourceType: row.type,
        resourceId: row.id,
      }));

      const database = testApp.module.get<DatabaseInstance>("DATABASE");

      /**
       * Both entry points, because the two reads take different ones: the org roster
       * goes through `execute` and the grant scan is a query builder. Counting only
       * one of them would miss the other entirely and pass without meaning it.
       */
      const statementsFor = async (subset: typeof asked) => {
        const execute = vi.spyOn(database, "execute");
        const select = vi.spyOn(database, "select");
        const counts = await sharingRepository.countCollaborators(organizationId, subset);
        assertSuccess(counts);
        const statements = execute.mock.calls.length + select.mock.calls.length;
        execute.mockRestore();
        select.mockRestore();
        return { statements, size: counts.value.size };
      };

      const few = await statementsFor(asked.slice(0, 3));
      const many = await statementsFor(asked);

      // Two reads, one per granularity the answer has, and neither grows with the
      // page — a loop over the rows would be one statement per resource.
      expect(many.statements).toBe(few.statements);
      expect(many.statements).toBe(2);
      // And every asked-for resource came back, including the ones with no grants at all.
      expect(many.size).toBe(asked.length);
    });

    it("asks for nothing when the organization owns nothing", async () => {
      const countCollaborators = vi.spyOn(sharingRepository, "countCollaborators");

      const result = await listResources.execute(organizationId, owner);
      assertSuccess(result);

      expect(result.value.resources).toEqual([]);
      const [, asked] = countCollaborators.mock.calls[0];
      expect(asked).toEqual([]);
    });
  });

  it("counts only what the caller may see it against, never another organization's grants", async () => {
    const elsewhere = await testApp.createOrganization("Somewhere Else", { visibility: "public" });
    await testApp.addOrganizationMember(elsewhere, member, "owner");
    const macro = await testApp.createMacro({ name: "Ours", createdBy: owner, organizationId });

    // Same id shape, different organization: every membership set is read for the
    // organization being viewed, so the other one's owner must not land on this row.
    const row = await showcaseRow(owner, macro.id);
    expect(row.collaboratorCount).toBe(2);
  });
});
