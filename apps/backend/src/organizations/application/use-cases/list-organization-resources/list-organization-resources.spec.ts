import { vi } from "vitest";

import type { DatabaseInstance } from "@repo/database";

import { assertSuccess } from "../../../../common/utils/fp-utils";
import { ListGrantsUseCase } from "../../../../sharing/application/use-cases/list-grants/list-grants";
import { SharingRepository } from "../../../../sharing/core/repositories/sharing.repository";
import { TestHarness } from "../../../../test/test-harness";
import { ListOrganizationResourcesUseCase } from "./list-organization-resources";

describe("listOrganizationResources", () => {
  const testApp = TestHarness.App;
  let listResources: ListOrganizationResourcesUseCase;
  let listGrants: ListGrantsUseCase;
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
    async function expectAgreement(resourceType: "macro" | "workbook", resourceId: string) {
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

      // One owner, no grants: the creator holds no grant on what they create, so a
      // count read off `resource_grants` alone would say zero here.
      expect(await expectAgreement("macro", macro.id)).toBe(1);
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

      expect(await expectAgreement("macro", macro.id)).toBe(2);
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
      expect(await expectAgreement("workbook", workbook.id)).toBe(2);
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
      expect(await expectAgreement("macro", macro.id)).toBe(1);
    });
  });

  describe("one read for the whole page", () => {
    /** A resource of every showcased type, so the page spans all four. */
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
      }
    }

    it("asks for every resource's count in a single call", async () => {
      await seedOneOfEveryType(3);
      const countCollaborators = vi.spyOn(sharingRepository, "countCollaborators");

      const result = await listResources.execute(organizationId, owner);
      assertSuccess(result);

      // A loop over the rows would be twelve calls on an organization this small, and
      // the showcase is uncapped — so the shape of the read, not its cost here, is
      // what this pins down.
      expect(countCollaborators).toHaveBeenCalledTimes(1);
      const [, asked] = countCollaborators.mock.calls[0];
      expect(asked).toHaveLength(12);
      expect(new Set(asked.map((row) => row.resourceId))).toEqual(
        new Set(result.value.resources.map((row) => row.id)),
      );
    });

    it("issues one statement whatever the resource count is", async () => {
      await seedOneOfEveryType(3);
      const rows = await listResources.execute(organizationId, owner);
      assertSuccess(rows);
      const asked = rows.value.resources.map((row) => ({
        resourceType: row.type,
        resourceId: row.id,
      }));

      const database = testApp.module.get<DatabaseInstance>("DATABASE");
      const execute = vi.spyOn(database, "execute");

      const counts = await sharingRepository.countCollaborators(organizationId, asked);
      assertSuccess(counts);

      // Nothing else runs in this window, so the call count *is* the query count.
      expect(execute).toHaveBeenCalledTimes(1);
      // And every asked-for resource came back, including the ones with no grants at all.
      expect(counts.value.size).toBe(asked.length);
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

    // Same id shape, different organization: the owner set is read for the organization
    // being viewed, so the other organization's owner must not land on this row.
    const row = await showcaseRow(owner, macro.id);
    expect(row.collaboratorCount).toBe(1);
  });
});
