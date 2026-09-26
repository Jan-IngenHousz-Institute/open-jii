import { faker } from "@faker-js/faker";

import type { ExperimentMembershipStatus } from "@repo/api/domains/experiment/experiment.schema";
import {
  experiments as experimentsTable,
  experimentMembers,
  organizationMembers,
  resourceGrants,
  eq,
  and,
} from "@repo/database";

import { assertSuccess } from "../../../common/utils/fp-utils";
import { TestHarness } from "../../../test/test-harness";
import { ExperimentJoinRequestRepository } from "./experiment-join-request.repository";
import { ExperimentRepository } from "./experiment.repository";

describe("ExperimentRepository", () => {
  const testApp = TestHarness.App;
  let repository: ExperimentRepository;
  let testUserId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    repository = testApp.module.get(ExperimentRepository);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("create", () => {
    it("should create a new experiment", async () => {
      // Arrange
      const createExperimentDto = {
        name: "Test Experiment",
        description: "Test Description",
        status: "active" as const,
        visibility: "private" as const,
      };

      // Act
      const result = await repository.create(createExperimentDto, testUserId);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const experiments = result.value;
      const experiment = experiments[0];

      expect(experiment).toMatchObject({
        id: expect.any(String) as string,
        name: createExperimentDto.name,
        description: createExperimentDto.description,
        status: createExperimentDto.status,
        visibility: createExperimentDto.visibility,
        createdBy: testUserId,
      });

      // Verify directly in database
      const dbResult = await testApp.database
        .select()
        .from(experimentsTable)
        .where(eq(experimentsTable.id, experiment.id));

      expect(dbResult.length).toBe(1);
      expect(dbResult[0]).toMatchObject({
        name: createExperimentDto.name,
        description: createExperimentDto.description,
        status: createExperimentDto.status,
        visibility: createExperimentDto.visibility,
        createdBy: testUserId,
      });
    });
  });

  describe("listCollaborators credit", () => {
    it("credits the creator themselves, not the org owner in their place", async () => {
      const org = await testApp.createOrganization();
      const orgOwner = await testApp.createTestUser({ name: "Olive Owner" });
      await testApp.addOrganizationMember(org, orgOwner, "owner");
      const author = await testApp.createTestUser({ name: "Adam Author" });
      await testApp.addOrganizationMember(org, author, "admin");

      const created = await repository.create(
        { name: `Credit ${crypto.randomUUID()}` },
        author,
        org,
      );
      assertSuccess(created);

      const result = await repository.listCollaborators(created.value[0].id);
      assertSuccess(result);

      // An org `admin` creator holds full control without owning the org, so they
      // get no grant — crediting only the owners would put somebody else's name on
      // their work and leave the author off their own experiment entirely.
      const credited = result.value.collaborators.map((c) => c.userId);
      expect(credited).toContain(author);
      expect(credited).toContain(orgOwner);
    });
  });

  describe("findAll", () => {
    it("applies explicit name sorting to both list shapes before paging", async () => {
      for (const name of ["Charlie", "Alpha", "Bravo"]) {
        await testApp.createExperiment({ name, userId: testUserId });
      }
      const sort = [{ field: "name", direction: "asc" }] as const;

      const all = await repository.findAll(
        testUserId,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        [...sort],
      );
      const first = await repository.findPage(
        testUserId,
        1,
        2,
        undefined,
        undefined,
        undefined,
        undefined,
        [...sort],
      );
      const second = await repository.findPage(
        testUserId,
        2,
        2,
        undefined,
        undefined,
        undefined,
        undefined,
        [...sort],
      );
      assertSuccess(all);
      assertSuccess(first);
      assertSuccess(second);

      expect(all.value.map((item) => item.name)).toEqual(["Alpha", "Bravo", "Charlie"]);
      expect(first.value.items.map((item) => item.name)).toEqual(["Alpha", "Bravo"]);
      expect(second.value.items.map((item) => item.name)).toEqual(["Charlie"]);
    });

    it("uses the second field within first-field ties and keeps page boundaries stable", async () => {
      for (const name of ["Alpha", "Bravo", "Charlie"]) {
        await testApp.createExperiment({ name, status: "active", userId: testUserId });
      }
      const sort = [
        { field: "status", direction: "asc" },
        { field: "name", direction: "desc" },
      ] as const;
      const first = await repository.findPage(
        testUserId,
        1,
        2,
        undefined,
        undefined,
        undefined,
        undefined,
        [...sort],
      );
      const second = await repository.findPage(
        testUserId,
        2,
        2,
        undefined,
        undefined,
        undefined,
        undefined,
        [...sort],
      );
      assertSuccess(first);
      assertSuccess(second);

      expect(first.value.items.map((item) => item.name)).toEqual(["Charlie", "Bravo"]);
      expect(second.value.items.map((item) => item.name)).toEqual(["Alpha"]);
      expect(
        new Set([...first.value.items, ...second.value.items].map((item) => item.id)).size,
      ).toBe(3);
    });

    it("uses an explicit order even when searching", async () => {
      await testApp.createExperiment({ name: "Alpha Project", userId: testUserId });
      await testApp.createExperiment({ name: "Zeta Project", userId: testUserId });

      const result = await repository.findPage(
        testUserId,
        1,
        20,
        undefined,
        undefined,
        "Project",
        undefined,
        [{ field: "name", direction: "desc" }],
      );
      assertSuccess(result);
      expect(result.value.items.map((item) => item.name)).toEqual([
        "Zeta Project",
        "Alpha Project",
      ]);
    });

    it("uses ID to keep equal sort values stable across pages", async () => {
      for (const name of ["First", "Second", "Third"]) {
        await testApp.createExperiment({ name, status: "active", userId: testUserId });
      }
      const sort = [{ field: "status", direction: "asc" }] as const;
      const first = await repository.findPage(
        testUserId,
        1,
        2,
        undefined,
        undefined,
        undefined,
        undefined,
        [...sort],
      );
      const second = await repository.findPage(
        testUserId,
        2,
        2,
        undefined,
        undefined,
        undefined,
        undefined,
        [...sort],
      );
      assertSuccess(first);
      assertSuccess(second);
      const ids = [...first.value.items, ...second.value.items].map((item) => item.id);
      expect(ids).toEqual([...ids].sort());
      expect(new Set(ids).size).toBe(3);
    });

    it("sorts computed owner, organization, and member columns plus updated time", async () => {
      const amy = await testApp.createTestUser({ name: "Amy Researcher" });
      const zoe = await testApp.createTestUser({ name: "Zoe Researcher" });
      const extra = await testApp.createTestUser({ name: "Extra Member" });
      const aOrg = await testApp.createOrganization("A Lab");
      const zOrg = await testApp.createOrganization("Z Lab");
      const { experiment: first } = await testApp.createExperiment({
        name: "Zoe experiment",
        userId: zoe,
        organizationId: aOrg,
      });
      const { experiment: second } = await testApp.createExperiment({
        name: "Amy experiment",
        userId: amy,
        organizationId: zOrg,
      });
      await testApp.addExperimentCollaborator(first.id, testUserId);
      await testApp.addExperimentCollaborator(second.id, testUserId);
      await testApp.addExperimentCollaborator(second.id, extra);
      await testApp.database
        .update(experimentsTable)
        .set({ updatedAt: new Date("2025-01-01T00:00:00Z") })
        .where(eq(experimentsTable.id, first.id));
      await testApp.database
        .update(experimentsTable)
        .set({ updatedAt: new Date("2025-01-02T00:00:00Z") })
        .where(eq(experimentsTable.id, second.id));

      for (const [field, expected] of [
        ["owner", [second.id, first.id]],
        ["organization", [first.id, second.id]],
        ["members", [first.id, second.id]],
        ["updated", [first.id, second.id]],
      ] as const) {
        const result = await repository.findAll(
          testUserId,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          [{ field, direction: "asc" }],
        );
        assertSuccess(result);
        expect(result.value.map((item) => item.id)).toEqual(expected);
      }
    });

    it("should return all experiments without filter", async () => {
      // Arrange
      const { experiment: experiment1 } = await testApp.createExperiment({
        name: "Experiment 1",
        userId: testUserId,
      });
      const { experiment: experiment2 } = await testApp.createExperiment({
        name: "Experiment 2",
        userId: testUserId,
      });

      // Act
      const result = await repository.findAll(testUserId);

      // Assert
      expect(result.isSuccess()).toBe(true);

      assertSuccess(result);
      const experiments = result.value;
      expect(experiments.length).toBe(2);
      expect(experiments).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: experiment1.id, name: "Experiment 1" }),
          expect.objectContaining({ id: experiment2.id, name: "Experiment 2" }),
        ]),
      );
    });

    it("should exclude archived experiments by default when no status is provided", async () => {
      // Arrange
      const userId = await testApp.createTestUser({ email: "exclude-archived@example.com" });
      const { experiment: active } = await testApp.createExperiment({
        name: "Active Experiment Default",
        userId,
        status: "active",
      });

      // Create an archived experiment for the same user
      await testApp.createExperiment({
        name: "Archived Experiment Default",
        userId,
        status: "archived",
      });

      // Act: call findAll without passing a status
      const result = await repository.findAll(userId);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const experiments = result.value;

      // Archived experiment should be excluded by default
      expect(experiments.some((e) => e.status === "archived")).toBe(false);
      // Active experiment should be present
      expect(experiments.some((e) => e.id === active.id)).toBe(true);
    });

    it("should return experiments in the correct order", async () => {
      // Arrange
      const { experiment: experiment1 } = await testApp.createExperiment({
        name: "Experiment 1",
        userId: testUserId,
      });
      const { experiment: experiment2 } = await testApp.createExperiment({
        name: "Experiment 2",
        userId: testUserId,
      });
      const { experiment: experiment3 } = await testApp.createExperiment({
        name: "Experiment 3",
        userId: testUserId,
      });
      const updateData = {
        status: "active" as const,
      };
      await repository.update(experiment2.id, updateData);

      // Act
      const result = await repository.findAll(testUserId);

      // Assert
      expect(result.isSuccess()).toBe(true);

      assertSuccess(result);
      const experiments = result.value;
      expect(experiments.length).toBe(3);
      expect(experiments).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: experiment2.id, name: "Experiment 2" }),
          expect.objectContaining({ id: experiment1.id, name: "Experiment 1" }),
          expect.objectContaining({ id: experiment3.id, name: "Experiment 3" }),
        ]),
      );
    });

    it("should filter experiments by 'member' filter", async () => {
      // Arrange
      const mainUserId = await testApp.createTestUser({
        email: "main-user@example.com",
      });
      const otherUserId = await testApp.createTestUser({
        email: "other-user@example.com",
      });

      // Create experiment owned by main user
      const { experiment: ownedExperiment } = await testApp.createExperiment({
        name: "My Experiment",
        userId: mainUserId,
      });

      // Create experiment owned by other user
      await testApp.createExperiment({
        name: "Other Experiment",
        userId: otherUserId,
      });

      // Act
      const result = await repository.findAll(mainUserId, "related");

      // Assert
      expect(result.isSuccess()).toBe(true);

      assertSuccess(result);
      const experiments = result.value;
      expect(experiments.length).toBe(1);
      expect(experiments[0].id).toBe(ownedExperiment.id);
      expect(experiments[0].name).toBe("My Experiment");
    });

    it("returns experiments reached through the owning organization under the 'member' filter", async () => {
      const org = await testApp.createOrganization();
      const author = await testApp.createTestUser({ email: "org-author@example.com" });
      const orgMember = await testApp.createTestUser({ email: "org-member@example.com" });
      await testApp.addOrganizationMember(org, author, "admin");
      await testApp.addOrganizationMember(org, orgMember, "member");

      const { experiment } = await testApp.createExperiment({
        name: "Org Experiment",
        userId: author,
        visibility: "private",
        organizationId: org,
      });

      const result = await repository.findAll(orgMember, "related");

      assertSuccess(result);
      expect(result.value.map((e) => e.id)).toEqual([experiment.id]);
    });

    it("returns experiments reached through a team grant under the 'member' filter", async () => {
      const org = await testApp.createOrganization();
      const author = await testApp.createTestUser({ email: "team-author@example.com" });
      const teammate = await testApp.createTestUser({ email: "teammate@example.com" });
      await testApp.addOrganizationMember(org, author, "admin");
      const team = await testApp.createTeam(org);
      await testApp.addTeamMember(team, teammate);

      const { experiment } = await testApp.createExperiment({
        name: "Team Experiment",
        userId: author,
        visibility: "private",
        organizationId: org,
      });
      await testApp.addResourceGrant({
        resourceType: "experiment",
        resourceId: experiment.id,
        granteeType: "team",
        granteeId: team,
        role: "viewer",
      });

      const result = await repository.findAll(teammate, "related");

      assertSuccess(result);
      expect(result.value.map((e) => e.id)).toEqual([experiment.id]);
    });

    it("returns experiments reached through an organization grant under the 'member' filter", async () => {
      const author = await testApp.createTestUser({ email: "org-grant-author@example.com" });
      const outsider = await testApp.createTestUser({ email: "org-grantee@example.com" });
      // The grantee's own org holds the grant; they are not in the owning org.
      const granteeOrg = await testApp.createOrganization();
      await testApp.addOrganizationMember(granteeOrg, outsider, "member");

      const { experiment } = await testApp.createExperiment({
        name: "Org Granted Experiment",
        userId: author,
        visibility: "private",
      });
      await testApp.addResourceGrant({
        resourceType: "experiment",
        resourceId: experiment.id,
        granteeType: "organization",
        granteeId: granteeOrg,
        role: "viewer",
      });

      const result = await repository.findAll(outsider, "related");

      assertSuccess(result);
      expect(result.value.map((e) => e.id)).toEqual([experiment.id]);
    });

    it("still excludes public experiments the caller is unrelated to under the 'member' filter", async () => {
      const mainUserId = await testApp.createTestUser({ email: "member-public@example.com" });
      const otherUserId = await testApp.createTestUser({
        email: "member-public-other@example.com",
      });

      await testApp.createExperiment({
        name: "Public Experiment",
        userId: otherUserId,
        visibility: "public",
      });

      const result = await repository.findAll(mainUserId, "related");

      assertSuccess(result);
      expect(result.value).toHaveLength(0);
    });

    it("should not return duplicate experiments when user has access to multiple experiments", async () => {
      // Arrange - Test case where a user is a member of multiple experiments
      // Ensures the CTE-based code doesn't cause duplicates
      const mainUserId = await testApp.createTestUser({
        email: "multi-member-test@example.com",
      });
      const otherUserId = await testApp.createTestUser({
        email: "other-owner@example.com",
      });

      // Create user's own experiment
      const { experiment: ownedExp } = await testApp.createExperiment({
        name: "My Experiment",
        userId: mainUserId,
      });

      // Create multiple experiments owned by other user
      const { experiment: exp1 } = await testApp.createExperiment({
        name: "Member Experiment 1",
        userId: otherUserId,
      });

      const { experiment: exp2 } = await testApp.createExperiment({
        name: "Member Experiment 2",
        userId: otherUserId,
      });

      const { experiment: exp3 } = await testApp.createExperiment({
        name: "Member Experiment 3",
        userId: otherUserId,
      });

      // Add main user as a member to all other experiments
      await testApp.addExperimentCollaborator(exp1.id, mainUserId);
      await testApp.addExperimentCollaborator(exp2.id, mainUserId);
      await testApp.addExperimentCollaborator(exp3.id, mainUserId);

      // Act - with no filter (should return all experiments user is a member of)
      const result = await repository.findAll(mainUserId);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const experiments = result.value;

      // Should return exactly 4 experiments (1 owned + 3 as member), no duplicates
      expect(experiments.length).toBe(4);

      // Verify no duplicate IDs
      const experimentIds = experiments.map((e) => e.id);
      const uniqueIds = new Set(experimentIds);
      expect(uniqueIds.size).toBe(4);

      // Verify all expected experiments are present
      expect(experiments).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: ownedExp.id }),
          expect.objectContaining({ id: exp1.id }),
          expect.objectContaining({ id: exp2.id }),
          expect.objectContaining({ id: exp3.id }),
        ]),
      );
    });

    it("should not return private experiments where user is not a member (no filter)", async () => {
      // Arrange
      const mainUserId = await testApp.createTestUser({
        email: "privacy-test@example.com",
      });
      const otherUserId = await testApp.createTestUser({
        email: "other-privacy-test@example.com",
      });

      // Create private experiment owned by other user
      await testApp.createExperiment({
        name: "Private Experiment",
        userId: otherUserId,
        visibility: "private",
      });

      // Create public experiment owned by other user
      const { experiment: publicExp } = await testApp.createExperiment({
        name: "Public Experiment",
        userId: otherUserId,
        visibility: "public",
      });

      // Act - query without filter as mainUser
      const result = await repository.findAll(mainUserId);

      // Assert - should only see public experiment
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const experiments = result.value;

      expect(experiments.length).toBe(1);
      expect(experiments[0].id).toBe(publicExp.id);
      expect(experiments[0].visibility).toBe("public");
    });

    it("should return private experiments where user is a member (no filter)", async () => {
      // Arrange
      const mainUserId = await testApp.createTestUser({
        email: "privacy-member-test@example.com",
      });
      const otherUserId = await testApp.createTestUser({
        email: "other-privacy-member-test@example.com",
      });

      // Create private experiment owned by other user
      const { experiment: privateExp } = await testApp.createExperiment({
        name: "Private Member Experiment",
        userId: otherUserId,
        visibility: "private",
      });

      // Add mainUser as member
      await testApp.addExperimentCollaborator(privateExp.id, mainUserId);

      // Act - query without filter as mainUser
      const result = await repository.findAll(mainUserId);

      // Assert - should see private experiment because user is a member
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const experiments = result.value;

      expect(experiments.length).toBe(1);
      expect(experiments[0].id).toBe(privateExp.id);
      expect(experiments[0].visibility).toBe("private");
    });

    it("should not return private experiments where user is not a member (with member filter)", async () => {
      // Arrange
      const mainUserId = await testApp.createTestUser({
        email: "privacy-filter-test@example.com",
      });
      const otherUserId = await testApp.createTestUser({
        email: "other-privacy-filter-test@example.com",
      });

      // Create private experiment owned by other user
      await testApp.createExperiment({
        name: "Private Experiment",
        userId: otherUserId,
        visibility: "private",
      });

      // Create public experiment owned by other user
      await testApp.createExperiment({
        name: "Public Experiment",
        userId: otherUserId,
        visibility: "public",
      });

      // Act - query with member filter as mainUser
      const result = await repository.findAll(mainUserId, "related");

      // Assert - should see nothing (not a member of any experiments)
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const experiments = result.value;

      expect(experiments.length).toBe(0);
    });

    it("should exclude archived experiments by default", async () => {
      // Arrange
      const mainUserId = await testApp.createTestUser({
        email: "archived-default-test@example.com",
      });

      // Create active experiment
      const { experiment: activeExp } = await testApp.createExperiment({
        name: "Active Experiment",
        userId: mainUserId,
        status: "active",
      });

      // Create archived experiment
      await testApp.createExperiment({
        name: "Archived Experiment",
        userId: mainUserId,
        status: "archived",
      });

      // Act - query without status filter
      const result = await repository.findAll(mainUserId);

      // Assert - should only see active experiment
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const experiments = result.value;

      expect(experiments.length).toBe(1);
      expect(experiments[0].id).toBe(activeExp.id);
      expect(experiments[0].status).toBe("active");
    });

    it("should exclude archived experiments even when filtering by other status", async () => {
      // Arrange
      const mainUserId = await testApp.createTestUser({
        email: "archived-status-test@example.com",
      });

      // Create active experiment
      const { experiment: activeExp } = await testApp.createExperiment({
        name: "Active Experiment",
        userId: mainUserId,
        status: "active",
      });

      // Create stale experiment
      await testApp.createExperiment({
        name: "Stale Experiment",
        userId: mainUserId,
        status: "stale",
      });

      // Create archived experiment
      await testApp.createExperiment({
        name: "Archived Experiment",
        userId: mainUserId,
        status: "archived",
      });

      // Act - query with active status filter
      const result = await repository.findAll(mainUserId, undefined, "active");

      // Assert - should only see active experiment
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const experiments = result.value;

      expect(experiments.length).toBe(1);
      expect(experiments[0].id).toBe(activeExp.id);
      expect(experiments[0].status).toBe("active");
    });

    it("should include archived experiments only when explicitly requested", async () => {
      // Arrange
      const mainUserId = await testApp.createTestUser({
        email: "archived-explicit-test@example.com",
      });

      // Create active experiment
      await testApp.createExperiment({
        name: "Active Experiment",
        userId: mainUserId,
        status: "active",
      });

      // Create archived experiment
      const { experiment: archivedExp } = await testApp.createExperiment({
        name: "Archived Experiment",
        userId: mainUserId,
        status: "archived",
      });

      // Act - query with archived status filter
      const result = await repository.findAll(mainUserId, undefined, "archived");

      // Assert - should only see archived experiment
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const experiments = result.value;

      expect(experiments.length).toBe(1);
      expect(experiments[0].id).toBe(archivedExp.id);
      expect(experiments[0].status).toBe("archived");
    });

    it("should filter experiments by status", async () => {
      // Arrange
      const userId = await testApp.createTestUser({
        email: "status-test@example.com",
      });

      // Create experiment with active status
      const { experiment: activeExperiment } = await testApp.createExperiment({
        name: "Active Experiment",
        userId,
        status: "active",
      });

      // Create experiment with archived status
      await testApp.createExperiment({
        name: "Archived Experiment",
        userId,
        status: "archived",
      });

      // Act - filter by active status
      const result = await repository.findAll(userId, undefined, "active");

      // Assert
      expect(result.isSuccess()).toBe(true);

      assertSuccess(result);
      const experiments = result.value;
      expect(experiments.length).toBe(1);
      expect(experiments[0].id).toBe(activeExperiment.id);
      expect(experiments[0].name).toBe("Active Experiment");
      expect(experiments[0].status).toBe("active");
    });

    it("should combine relationship filter with status filter", async () => {
      // Arrange
      const mainUserId = await testApp.createTestUser({
        email: "main-combo@example.com",
      });
      const otherUserId = await testApp.createTestUser({
        email: "other-combo@example.com",
      });

      // Create active experiment owned by main user
      const { experiment: myActive } = await testApp.createExperiment({
        name: "My Active",
        userId: mainUserId,
        status: "active",
      });

      // Create archived experiment owned by main user
      await testApp.createExperiment({
        name: "My Archived",
        userId: mainUserId,
        status: "archived",
      });

      // Create active experiment owned by other user
      const { experiment: otherActive } = await testApp.createExperiment({
        name: "Other Active",
        userId: otherUserId,
        status: "active",
      });

      // Act - scope to "related" with "active" status
      const result = await repository.findAll(mainUserId, "related", "active");

      // Assert
      expect(result.isSuccess()).toBe(true);

      assertSuccess(result);
      const experiments = result.value;
      expect(experiments.length).toBe(1);
      expect(experiments[0].id).toBe(myActive.id);
      expect(experiments[0].name).toBe("My Active");
      expect(experiments[0].status).toBe("active");

      // This experiment should be filtered out because it's by another user
      expect(experiments.some((e) => e.id === otherActive.id)).toBe(false);
    });
    it("should filter experiments by search term in name", async () => {
      // Arrange
      const userId = await testApp.createTestUser({ email: "search-test@example.com" });
      await testApp.createExperiment({ name: "Alpha Experiment", userId });
      await testApp.createExperiment({ name: "Beta Experiment", userId });
      await testApp.createExperiment({ name: "Gamma", userId });

      // Act
      const result = await repository.findAll(userId, undefined, undefined, "Experiment");

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const experiments = result.value;
      expect(experiments.length).toBe(2);
      expect(experiments).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: "Alpha Experiment" }),
          expect.objectContaining({ name: "Beta Experiment" }),
        ]),
      );
      expect(experiments.some((e) => e.name === "Gamma")).toBe(false);
    });

    it("should filter experiments by search term, relationship, and status together", async () => {
      // Arrange
      const mainUserId = await testApp.createTestUser({
        email: "search-rel-status-repo@example.com",
      });
      const otherUserId = await testApp.createTestUser({
        email: "search-rel-status-repo-other@example.com",
      });

      // Create experiments with unique names and statuses
      await testApp.createExperiment({
        name: "My Searchable Active",
        userId: mainUserId,
        status: "active",
      });
      await testApp.createExperiment({
        name: "My Searchable Archived",
        userId: mainUserId,
        status: "archived",
      });
      await testApp.createExperiment({
        name: "My Unrelated",
        userId: mainUserId,
        status: "active",
      });
      const { experiment: memberExpActive } = await testApp.createExperiment({
        name: "Member Searchable Active",
        userId: otherUserId,
        status: "active",
      });
      const { experiment: memberExpArchived } = await testApp.createExperiment({
        name: "Member Searchable Archived",
        userId: otherUserId,
        status: "archived",
      });
      await testApp.addExperimentCollaborator(memberExpActive.id, mainUserId);
      await testApp.addExperimentCollaborator(memberExpArchived.id, mainUserId);
      await testApp.createExperiment({
        name: "Other Experiment",
        userId: otherUserId,
        status: "active",
      });

      // Act
      const result = await repository.findAll(mainUserId, undefined, "active", "Searchable");

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const experiments = result.value;
      // Should only return 'My Searchable Active' and 'Member Searchable Active' with status 'active'
      expect(experiments.length).toBe(2);
      expect(experiments).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: "My Searchable Active", status: "active" }),
          expect.objectContaining({ name: "Member Searchable Active", status: "active" }),
        ]),
      );
      // Should not return archived or unrelated experiments
      expect(
        experiments.some(
          (e) =>
            e.status === "archived" || e.name === "My Unrelated" || e.name === "Other Experiment",
        ),
      ).toBe(false);
    });
  });

  describe("findAll full-text search ranking", () => {
    it("ranks a name match above a match on the creator's name", async () => {
      // Creator whose profile name contains the search term.
      const creatorId = await testApp.createTestUser({ name: "Photosynthesis Researcher" });

      // E1 matches by NAME; E2 matches only because its CREATOR is named "Photosynthesis".
      await testApp.createExperiment({
        name: "Photosynthesis study",
        userId: testUserId,
        visibility: "public",
      });
      await testApp.createExperiment({
        name: "Maize field trial",
        userId: creatorId,
        visibility: "public",
      });

      const result = await repository.findAll(testUserId, undefined, undefined, "Photosynthesis");

      assertSuccess(result);
      const names = result.value.map((e) => e.name);
      expect(names).toContain("Photosynthesis study");
      expect(names).toContain("Maize field trial");
      // The experiment whose NAME matches must come first.
      expect(names.indexOf("Photosynthesis study")).toBeLessThan(
        names.indexOf("Maize field trial"),
      );
    });

    it("matches the description and tolerates a typo in the name", async () => {
      await testApp.createExperiment({
        name: "Bioluminescence",
        description: "measures chlorophyll fluorescence",
        userId: testUserId,
        visibility: "public",
      });

      const byDescription = await repository.findAll(
        testUserId,
        undefined,
        undefined,
        "chlorophyll",
      );
      assertSuccess(byDescription);
      expect(byDescription.value.some((e) => e.name === "Bioluminescence")).toBe(true);

      const byTypo = await repository.findAll(testUserId, undefined, undefined, "bioluminecence");
      assertSuccess(byTypo);
      expect(byTypo.value.some((e) => e.name === "Bioluminescence")).toBe(true);
    });

    it("matches an experiment by a member's name (not just the creator)", async () => {
      // Member whose profile name carries a distinctive token absent from the experiment + creator.
      const memberId = await testApp.createTestUser({ name: "Zelkova Memberton" });
      const { experiment } = await testApp.createExperiment({
        name: "Maize field trial",
        userId: testUserId,
        visibility: "public",
      });
      await testApp.addExperimentCollaborator(experiment.id, memberId);

      const result = await repository.findAll(testUserId, undefined, undefined, "Zelkova");
      assertSuccess(result);
      expect(result.value.some((e) => e.name === "Maize field trial")).toBe(true);
    });

    it("matches every experiment location field", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Maize field trial",
        userId: testUserId,
        visibility: "public",
      });
      await testApp.addExperimentLocation({
        experimentId: experiment.id,
        name: "Northridge Station",
        country: "Zedland",
        region: "Quibble Valley",
        municipality: "Flergborough",
        addressLabel: "42 Wombat Avenue",
      });

      for (const term of ["northridge", "zedland", "quibble", "flergborough", "wombat"]) {
        const result = await repository.findAll(testUserId, undefined, undefined, term);
        assertSuccess(result);
        expect(result.value.some((candidate) => candidate.name === "Maize field trial")).toBe(true);
      }
    });

    it("does prefix matching", async () => {
      await testApp.createExperiment({
        name: "Spectral reflectance assay",
        userId: testUserId,
      });

      const result = await repository.findAll(testUserId, undefined, undefined, "spectr");
      assertSuccess(result);
      expect(
        result.value.some((experiment) => experiment.name === "Spectral reflectance assay"),
      ).toBe(true);
    });

    it("matches names case-insensitively", async () => {
      await testApp.createExperiment({
        name: "Casefold Canopy Trial",
        userId: testUserId,
      });

      const result = await repository.findAll(testUserId, undefined, undefined, "CASEFOLD");
      assertSuccess(result);
      expect(result.value.some((experiment) => experiment.name === "Casefold Canopy Trial")).toBe(
        true,
      );
    });

    it("does stemming", async () => {
      await testApp.createExperiment({ name: "Running field trials", userId: testUserId });

      const result = await repository.findAll(testUserId, undefined, undefined, "run");
      assertSuccess(result);
      expect(result.value.some((experiment) => experiment.name === "Running field trials")).toBe(
        true,
      );
    });

    it("matches names containing punctuation", async () => {
      await testApp.createExperiment({ name: "Ridge-01 canopy", userId: testUserId });

      const result = await repository.findAll(testUserId, undefined, undefined, "ridge-01");
      assertSuccess(result);
      expect(result.value.some((experiment) => experiment.name === "Ridge-01 canopy")).toBe(true);
    });

    it("excludes deactivated contributors from name matching entirely", async () => {
      const ghostId = await testApp.createTestUser({ name: "Casper Ghostly", activated: false });
      await testApp.createExperiment({
        name: "Maize field trial",
        userId: ghostId,
        visibility: "public",
      });

      // Neither the real name nor the "Unknown User" placeholder surfaces the experiment — a
      // deactivated account simply doesn't participate in name search.
      for (const term of ["Casper", "Unknown User"]) {
        const result = await repository.findAll(testUserId, undefined, undefined, term);
        assertSuccess(result);
        expect(result.value.some((e) => e.name === "Maize field trial")).toBe(false);
      }
    });

    it("excludes deleted contributors from creator and member matching", async () => {
      // Active (activated=true) but soft-deleted accounts must not be matchable by name.
      const deletedCreatorId = await testApp.createTestUser({
        name: "Deleted Creator",
        deletedAt: new Date(),
      });
      await testApp.createExperiment({
        name: "Maize field trial",
        userId: deletedCreatorId,
        visibility: "public",
      });

      const deletedMemberId = await testApp.createTestUser({
        name: "Deleted Member",
        deletedAt: new Date(),
      });
      const { experiment } = await testApp.createExperiment({
        name: "Sorghum field trial",
        userId: testUserId,
        visibility: "public",
      });
      await testApp.addExperimentCollaborator(experiment.id, deletedMemberId);

      const byCreator = await repository.findAll(
        testUserId,
        undefined,
        undefined,
        "Deleted Creator",
      );
      assertSuccess(byCreator);
      expect(byCreator.value.some((e) => e.name === "Maize field trial")).toBe(false);

      const byMember = await repository.findAll(testUserId, undefined, undefined, "Deleted Member");
      assertSuccess(byMember);
      expect(byMember.value.some((e) => e.name === "Sorghum field trial")).toBe(false);
    });

    it("respects the requested search result limit", async () => {
      for (const suffix of ["Alpha", "Bravo", "Charlie"]) {
        await testApp.createExperiment({
          name: `Limitprobe ${suffix}`,
          userId: testUserId,
        });
      }

      const result = await repository.findAll(testUserId, undefined, undefined, "limitprobe", 2);

      assertSuccess(result);
      expect(result.value).toHaveLength(2);
    });
  });

  describe("findOne", () => {
    it("should find an experiment by id", async () => {
      // Arrange
      const { experiment } = await testApp.createExperiment({
        name: "Experiment to Find",
        description: "Should be found by ID",
        userId: testUserId,
      });

      // Act
      const result = await repository.findOne(experiment.id);

      // Assert
      expect(result.isSuccess()).toBe(true);

      assertSuccess(result);
      const foundExperiment = result.value;
      expect(foundExperiment).toMatchObject({
        id: experiment.id,
        name: "Experiment to Find",
        description: "Should be found by ID",
        createdBy: testUserId,
      });
    });

    it("should return null if experiment not found", async () => {
      // Act
      const result = await repository.findOne("00000000-0000-0000-0000-000000000000");

      // Assert
      expect(result.isSuccess()).toBe(true);

      assertSuccess(result);
      expect(result.value).toBeNull();
    });
  });

  describe("update", () => {
    it("should update an experiment", async () => {
      // Arrange
      const { experiment } = await testApp.createExperiment({
        name: "Original Name",
        description: "Original Description",
        userId: testUserId,
      });

      const updateData = {
        name: "Updated Name",
        description: "Updated Description",
        status: "active" as const,
      };

      // Act
      const updateResult = await repository.update(experiment.id, updateData);

      // Assert
      expect(updateResult.isSuccess()).toBe(true);
      expect(updateResult._tag).toBe("success");

      assertSuccess(updateResult);
      const updatedExperiments = updateResult.value;
      const updatedExperiment = updatedExperiments[0];

      expect(updatedExperiment).toMatchObject({
        id: experiment.id,
        name: updateData.name,
        description: updateData.description,
        status: updateData.status,
        createdBy: testUserId,
      });

      // Verify database directly
      const dbExperiment = await testApp.database
        .select()
        .from(experimentsTable)
        .where(eq(experimentsTable.id, experiment.id))
        .limit(1);

      expect(dbExperiment.length).toBe(1);
      expect(dbExperiment[0].name).toBe(updateData.name);
      expect(dbExperiment[0].description).toBe(updateData.description);
      expect(dbExperiment[0].status).toBe(updateData.status);
    });

    it("should update the updatedAt timestamp when an experiment is modified", async () => {
      // Arrange
      const { experiment } = await testApp.createExperiment({
        name: "Timestamp Test Experiment",
        description: "Testing updatedAt",
        userId: testUserId,
      });

      // Store the original updatedAt timestamp
      const originalExperiment = await testApp.database
        .select()
        .from(experimentsTable)
        .where(eq(experimentsTable.id, experiment.id))
        .limit(1);

      const originalUpdatedAt = originalExperiment[0].updatedAt;

      // Add a small delay to ensure timestamp will be different
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Act: update the experiment
      const updateData = {
        name: "Updated Timestamp Experiment",
      };

      const updateResult = await repository.update(experiment.id, updateData);
      expect(updateResult.isSuccess()).toBe(true);

      // Assert: verify updatedAt was changed
      const updatedExperiment = await testApp.database
        .select()
        .from(experimentsTable)
        .where(eq(experimentsTable.id, experiment.id))
        .limit(1);

      expect(updatedExperiment[0].updatedAt).not.toEqual(originalUpdatedAt);
      expect(updatedExperiment[0].updatedAt > originalUpdatedAt).toBe(true);
    });
  });

  describe("delete", () => {
    it("should delete an experiment and its members", async () => {
      // Arrange
      const { experiment } = await testApp.createExperiment({
        name: "Experiment to Delete",
        userId: testUserId,
      });

      // Add a member to the experiment
      const memberId = await testApp.createTestUser({
        email: "member@example.com",
      });
      await testApp.addExperimentCollaborator(experiment.id, memberId);

      // Act
      const deleteResult = await repository.delete(experiment.id);

      // Assert
      expect(deleteResult.isSuccess()).toBe(true);

      // Assert directly from database
      const deletedExperiment = await testApp.database
        .select()
        .from(experimentsTable)
        .where(eq(experimentsTable.id, experiment.id));
      expect(deletedExperiment.length).toBe(0);

      // Verify members were deleted
      const members = await testApp.database
        .select()
        .from(experimentMembers)
        .where(eq(experimentMembers.experimentId, experiment.id));
      expect(members.length).toBe(0);
    });
  });

  describe("checkAccess", () => {
    it("should return experiment and access info when user is creator", async () => {
      // Arrange
      const { experiment } = await testApp.createExperiment({
        name: "Creator Access Test",
        userId: testUserId,
      });

      // Act
      const result = await repository.checkAccess(experiment.id, testUserId);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);

      expect(result.value.experiment).toBeTruthy();
      expect(result.value.hasAccess).toBe(true);
      expect(result.value.isAdmin).toBe(true);

      // Verify directly in database
      const dbExperiment = await testApp.database
        .select()
        .from(experimentsTable)
        .where(
          and(eq(experimentsTable.id, experiment.id), eq(experimentsTable.createdBy, testUserId)),
        );
      expect(dbExperiment.length).toBe(1);
    });

    it("should return experiment and access info when user is an admin member", async () => {
      // Arrange
      const creatorId = await testApp.createTestUser({
        email: "creator@example.com",
      });
      const adminId = await testApp.createTestUser({
        email: "admin@example.com",
      });

      const { experiment } = await testApp.createExperiment({
        name: "Admin Access Test",
        userId: creatorId,
      });

      await testApp.addExperimentAdmin(experiment.id, adminId);

      // Act
      const result = await repository.checkAccess(experiment.id, adminId);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);

      expect(result.value.experiment).toBeTruthy();
      expect(result.value.hasAccess).toBe(true);
      expect(result.value.isAdmin).toBe(true);

      // isAdmin comes from the direct admin grant — the only place a tier lives.
      const staffingGrant = await testApp.database
        .select()
        .from(resourceGrants)
        .where(
          and(
            eq(resourceGrants.resourceType, "experiment"),
            eq(resourceGrants.resourceId, experiment.id),
            eq(resourceGrants.granteeType, "user"),
            eq(resourceGrants.granteeId, adminId),
            eq(resourceGrants.role, "admin"),
          ),
        );
      expect(staffingGrant.length).toBe(1);
    });

    it("should return experiment and access info when user is a regular member", async () => {
      // Arrange
      const creatorId = await testApp.createTestUser({
        email: "creator@example.com",
      });
      const memberId = await testApp.createTestUser({
        email: "member@example.com",
      });

      const { experiment } = await testApp.createExperiment({
        name: "Member Access Test",
        userId: creatorId,
      });

      await testApp.addExperimentCollaborator(experiment.id, memberId);

      // Act
      const result = await repository.checkAccess(experiment.id, memberId);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);

      expect(result.value.experiment).toBeTruthy();
      expect(result.value.hasAccess).toBe(true);
      expect(result.value.isAdmin).toBe(false);

      // The access came from a grant — the only place it can come from.
      const grants = await testApp.database
        .select()
        .from(resourceGrants)
        .where(
          and(
            eq(resourceGrants.resourceType, "experiment"),
            eq(resourceGrants.resourceId, experiment.id),
            eq(resourceGrants.granteeId, memberId),
          ),
        );
      expect(grants.map((g) => g.role)).toEqual(["viewer"]);
    });

    it("should indicate no access when user has no relation to the experiment", async () => {
      // Arrange
      const { experiment } = await testApp.createExperiment({
        name: "No Access Test",
        userId: testUserId,
      });

      const nonMemberId = await testApp.createTestUser({
        email: "non-member@example.com",
      });

      // Act
      const result = await repository.checkAccess(experiment.id, nonMemberId);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);

      expect(result.value.experiment).toBeTruthy();
      expect(result.value.hasAccess).toBe(false);
      expect(result.value.isAdmin).toBe(false);

      // ...and no grant to them exists.
      const grants = await testApp.database
        .select()
        .from(resourceGrants)
        .where(
          and(
            eq(resourceGrants.resourceType, "experiment"),
            eq(resourceGrants.resourceId, experiment.id),
            eq(resourceGrants.granteeId, nonMemberId),
          ),
        );
      expect(grants).toHaveLength(0);
    });

    it("should set hasArchiveAccess=false for all users when experiment is archived", async () => {
      // Arrange: create an archived experiment
      const { experiment } = await testApp.createExperiment({
        name: "Archive Access Test",
        userId: testUserId,
        status: "archived",
      });

      // Create a member user and add them as a regular member
      const memberId = await testApp.createTestUser({ email: "archive-member@example.com" });
      await testApp.addExperimentCollaborator(experiment.id, memberId);

      // Act: check access for non-admin member
      const memberResult = await repository.checkAccess(experiment.id, memberId);
      expect(memberResult.isSuccess()).toBe(true);
      assertSuccess(memberResult);

      const memberAccess = memberResult.value;
      expect(memberAccess.experiment).toBeTruthy();
      expect(memberAccess.hasAccess).toBe(true);
      expect(memberAccess.isAdmin).toBe(false);
      expect(memberAccess.hasArchiveAccess).toBe(false);

      // Raise their grant to the admin tier — that grant is what can()-based
      // isAdmin resolves from.
      await testApp.database
        .update(resourceGrants)
        .set({ role: "admin" })
        .where(
          and(
            eq(resourceGrants.resourceType, "experiment"),
            eq(resourceGrants.resourceId, experiment.id),
            eq(resourceGrants.granteeId, memberId),
          ),
        );

      // Act again: check access for admin
      const adminResult = await repository.checkAccess(experiment.id, memberId);
      expect(adminResult.isSuccess()).toBe(true);
      assertSuccess(adminResult);

      const adminAccess = adminResult.value;
      expect(adminAccess.experiment).toBeTruthy();
      expect(adminAccess.hasAccess).toBe(true);
      expect(adminAccess.isAdmin).toBe(true);
      expect(adminAccess.hasArchiveAccess).toBe(false);
    });

    it("should return null experiment and no access when experiment does not exist", async () => {
      // Act
      const result = await repository.checkAccess(
        "00000000-0000-0000-0000-000000000000",
        testUserId,
      );

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);

      expect(result.value.experiment).toBeNull();
      expect(result.value.hasAccess).toBe(false);
      expect(result.value.isAdmin).toBe(false);

      // Verify directly in database
      const experimentCheck = await testApp.database
        .select()
        .from(experimentsTable)
        .where(eq(experimentsTable.id, "00000000-0000-0000-0000-000000000000"));
      expect(experimentCheck.length).toBe(0);
    });

    it("counts the direct collaborator grants", async () => {
      const { experiment } = await testApp.createExperiment({
        name: `Members two ${faker.string.uuid()}`,
        userId: testUserId,
      });
      for (const email of ["one@example.com", "two@example.com"]) {
        await testApp.addExperimentCollaborator(
          experiment.id,
          await testApp.createTestUser({ email }),
        );
      }

      const result = await repository.checkAccess(experiment.id, testUserId);

      assertSuccess(result);
      expect(result.value.experiment?.membersCount).toBe(2);
    });

    it("reports zero when nobody was granted it", async () => {
      const { experiment } = await testApp.createExperiment({
        name: `Members none ${faker.string.uuid()}`,
        userId: testUserId,
      });

      const result = await repository.checkAccess(experiment.id, testUserId);

      assertSuccess(result);
      expect(result.value.experiment?.membersCount).toBe(0);
    });

    it("does not count team or organization grants", async () => {
      // Reach through a team or an org is unbounded, so it is not a headcount.
      const organizationId = await testApp.createOrganization();
      const teamId = await testApp.createTeam(organizationId);
      await testApp.addTeamMember(teamId, await testApp.createTestUser({}));
      const { experiment } = await testApp.createExperiment({
        name: `Members indirect ${faker.string.uuid()}`,
        userId: testUserId,
      });
      await testApp.addResourceGrant({
        resourceType: "experiment",
        resourceId: experiment.id,
        granteeType: "team",
        granteeId: teamId,
        role: "viewer",
      });
      await testApp.addResourceGrant({
        resourceType: "experiment",
        resourceId: experiment.id,
        granteeType: "organization",
        granteeId: organizationId,
        role: "viewer",
      });

      const result = await repository.checkAccess(experiment.id, testUserId);

      assertSuccess(result);
      expect(result.value.experiment?.membersCount).toBe(0);
    });

    it("agrees with the list row for the same experiment", async () => {
      const { experiment } = await testApp.createExperiment({
        name: `Members agreement ${faker.string.uuid()}`,
        userId: testUserId,
      });
      await testApp.addExperimentCollaborator(
        experiment.id,
        await testApp.createTestUser({ email: "agree@example.com" }),
      );

      const listed = await repository.findAll(testUserId, "all");
      const access = await repository.checkAccess(experiment.id, testUserId);
      assertSuccess(listed);
      assertSuccess(access);

      const row = listed.value.find((entry) => entry.id === experiment.id);
      expect({ list: row?.membersCount, access: access.value.experiment?.membersCount }).toEqual({
        list: 1,
        access: 1,
      });
    });
  });

  describe("findExpiredEmbargoes", () => {
    it("should return only private experiments whose embargoUntil is in the past", async () => {
      const now = Date.now();

      // private + past (should be returned)
      const { experiment: pastPrivate } = await testApp.createExperiment({
        name: "Past Private",
        userId: testUserId,
        visibility: "private",
        embargoUntil: new Date(now - 60_000), // 1 min ago
      });

      // private + future (should NOT be returned)
      await testApp.createExperiment({
        name: "Future Private",
        userId: testUserId,
        visibility: "private",
        embargoUntil: new Date(now + 60_000),
      });

      // public + past (should NOT be returned)
      await testApp.createExperiment({
        name: "Past Public",
        userId: testUserId,
        visibility: "public",
        embargoUntil: new Date(now - 60_000),
      });

      const result = await repository.findExpiredEmbargoes();

      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const experiments = result.value;

      expect(experiments).toHaveLength(1);
      expect(experiments[0].id).toBe(pastPrivate.id);
      expect(experiments[0].visibility).toBe("private");
    });

    // it("should not return experiments whose embargoUntil is exactly now or in the future", async () => {
    //   const nearFuture = new Date(Date.now() + 10);

    //   await testApp.createExperiment({
    //     name: "Boundary Private",
    //     userId: testUserId,
    //     visibility: "private",
    //     embargoUntil: nearFuture,
    //   });

    //   const result = await repository.findExpiredEmbargoes();

    //   expect(result.isSuccess()).toBe(true);
    //   assertSuccess(result);
    //   const experiments = result.value;

    //   expect(experiments.some((e) => e.name === "Boundary Private")).toBe(false);
    // });
  });

  describe("grant teardown on delete", () => {
    /** The grants on one resource — no FK cascade cleans `resource_grants` up. */
    const grantsFor = (resourceId: string) =>
      testApp.database
        .select()
        .from(resourceGrants)
        .where(
          and(
            eq(resourceGrants.resourceType, "experiment"),
            eq(resourceGrants.resourceId, resourceId),
          ),
        );

    async function sharedExperiment() {
      const grantee = await testApp.createTestUser({ name: "Teardown Grantee" });
      const { experiment } = await testApp.createExperiment({
        name: `Exp ${crypto.randomUUID()}`,
        userId: testUserId,
      });
      // The creator holds no grant, so the only row is this direct share.
      await testApp.addResourceGrant({
        resourceType: "experiment",
        resourceId: experiment.id,
        granteeType: "user",
        granteeId: grantee,
        role: "admin",
      });
      const before = await grantsFor(experiment.id);
      expect(before.map((g) => g.granteeId)).toEqual([grantee]);
      return experiment;
    }

    it("deletes every grant on the experiment along with it", async () => {
      const experiment = await sharedExperiment();

      assertSuccess(await repository.delete(experiment.id));

      expect(await grantsFor(experiment.id)).toHaveLength(0);
    });
  });

  /**
   * `membershipStatus` is computed twice — in SQL for a whole listing, and from
   * `can(contribute)` for one experiment — and the two must never disagree. A list row
   * that claims membership the detail screen denies is a participant told they may
   * measure into something that will refuse their data.
   *
   * Every case here asserts both computations at once, so a divergence fails rather
   * than hiding in whichever surface the test happened to read.
   */
  describe("membershipStatus", () => {
    let joinRequestRepository: ExperimentJoinRequestRepository;
    let ownerId: string;
    let callerId: string;

    beforeEach(async () => {
      ownerId = await testApp.createTestUser({ email: "owner@example.com" });
      callerId = await testApp.createTestUser({ email: "caller@example.com" });
      joinRequestRepository = testApp.module.get(ExperimentJoinRequestRepository);
    });

    async function seedExperiment(options: { createdBy?: string; organizationId?: string } = {}) {
      const { experiment } = await testApp.createExperiment({
        name: `Membership ${faker.string.uuid()}`,
        userId: options.createdBy ?? ownerId,
        visibility: "public",
        ...(options.organizationId ? { organizationId: options.organizationId } : {}),
      });
      return experiment;
    }

    /** What the list row says and what the access read says, for the same caller. */
    async function bothViews(experimentId: string, userId: string) {
      const listed = await repository.findAll(userId, "all");
      assertSuccess(listed);
      const row = listed.value.find((entry) => entry.id === experimentId);

      const access = await repository.checkAccess(experimentId, userId);
      assertSuccess(access);

      return {
        list: row?.membershipStatus,
        access: access.value.membershipStatus,
        canContribute: access.value.canContribute,
      };
    }

    /**
     * Both computations agree, and they agree with `can(contribute)` — which is what
     * `member` is defined to mean.
     */
    async function expectAgreement(
      experimentId: string,
      userId: string,
      expected: ExperimentMembershipStatus,
    ) {
      const views = await bothViews(experimentId, userId);

      expect(views).toEqual({
        list: expected,
        access: expected,
        canContribute: expected === "member",
      });
    }

    describe("every relationship path that carries contribute reads as member", () => {
      it("direct viewer grant", async () => {
        const experiment = await seedExperiment();
        await testApp.addExperimentCollaborator(experiment.id, callerId);

        await expectAgreement(experiment.id, callerId, "member");
      });

      it("direct admin grant", async () => {
        const experiment = await seedExperiment();
        await testApp.addExperimentAdmin(experiment.id, callerId);

        await expectAgreement(experiment.id, callerId, "member");
      });

      it("team grant", async () => {
        const organizationId = await testApp.createOrganization();
        await testApp.addOrganizationMember(organizationId, ownerId, "owner");
        const teamId = await testApp.createTeam(organizationId);
        await testApp.addTeamMember(teamId, callerId);
        const experiment = await seedExperiment({ organizationId });
        await testApp.addResourceGrant({
          resourceType: "experiment",
          resourceId: experiment.id,
          granteeType: "team",
          granteeId: teamId,
          role: "viewer",
        });

        await expectAgreement(experiment.id, callerId, "member");
      });

      it("organization grant", async () => {
        const granteeOrgId = await testApp.createOrganization();
        await testApp.addOrganizationMember(granteeOrgId, callerId, "member");
        const experiment = await seedExperiment();
        await testApp.addResourceGrant({
          resourceType: "experiment",
          resourceId: experiment.id,
          granteeType: "organization",
          granteeId: granteeOrgId,
          role: "viewer",
        });

        await expectAgreement(experiment.id, callerId, "member");
      });

      it("owning-org member", async () => {
        const organizationId = await testApp.createOrganization();
        await testApp.addOrganizationMember(organizationId, ownerId, "owner");
        await testApp.addOrganizationMember(organizationId, callerId, "member");
        const experiment = await seedExperiment({ organizationId });

        await expectAgreement(experiment.id, callerId, "member");
      });

      it("owning-org admin", async () => {
        const organizationId = await testApp.createOrganization();
        await testApp.addOrganizationMember(organizationId, ownerId, "owner");
        await testApp.addOrganizationMember(organizationId, callerId, "admin");
        const experiment = await seedExperiment({ organizationId });

        await expectAgreement(experiment.id, callerId, "member");
      });

      it("creator in their own personal workspace", async () => {
        const experiment = await seedExperiment({ createdBy: callerId });

        await expectAgreement(experiment.id, callerId, "member");
      });
    });

    describe("no contributing path", () => {
      it("a public reader is none on both", async () => {
        const experiment = await seedExperiment();

        await expectAgreement(experiment.id, callerId, "none");
      });

      it("a public reader with a pending request is pending_request on both", async () => {
        const experiment = await seedExperiment();
        assertSuccess(await joinRequestRepository.create(experiment.id, callerId, "let me in"));

        await expectAgreement(experiment.id, callerId, "pending_request");
      });

      it("falls back to none once that request is decided", async () => {
        const experiment = await seedExperiment();
        const request = await joinRequestRepository.create(experiment.id, callerId, undefined);
        assertSuccess(request);
        assertSuccess(
          await joinRequestRepository.markDecided(request.value.id, "cancelled", callerId),
        );

        await expectAgreement(experiment.id, callerId, "none");
      });

      it("a member with a stale pending request still reads as member", async () => {
        // Membership wins: the request is moot, and `pending_request` would offer a
        // CTA to ask for access they already hold.
        const experiment = await seedExperiment();
        assertSuccess(await joinRequestRepository.create(experiment.id, callerId, undefined));
        await testApp.addExperimentCollaborator(experiment.id, callerId);

        await expectAgreement(experiment.id, callerId, "member");
      });

      it("a creator removed from the owning organization is none, though they still see the row", async () => {
        // Authorship is not an access path. The row stays reachable under `related`,
        // and the truth about it is that they can look but not measure.
        const organizationId = await testApp.createOrganization();
        await testApp.addOrganizationMember(organizationId, callerId, "member");
        const experiment = await seedExperiment({ createdBy: callerId, organizationId });
        await testApp.database
          .delete(organizationMembers)
          .where(eq(organizationMembers.userId, callerId));

        await expectAgreement(experiment.id, callerId, "none");

        const related = await repository.findAll(callerId, "related");
        assertSuccess(related);
        const row = related.value.find((entry) => entry.id === experiment.id);
        expect(row?.membershipStatus).toBe("none");
      });

      it("a grant on another experiment does not leak across rows", async () => {
        const granted = await seedExperiment();
        const other = await seedExperiment();
        await testApp.addExperimentCollaborator(granted.id, callerId);

        await expectAgreement(granted.id, callerId, "member");
        await expectAgreement(other.id, callerId, "none");
      });
    });

    /**
     * Both role columns are unrestricted text, and `can()` tokenizes them and refuses
     * anything it does not recognize. These rows are written raw because the write
     * helpers refuse them — which is exactly why the SQL cannot assume they are absent.
     */
    describe("stored role tokens the write helpers would refuse", () => {
      async function rawGrant(experimentId: string, role: string) {
        await testApp.database.insert(resourceGrants).values({
          resourceType: "experiment",
          resourceId: experimentId,
          granteeType: "user",
          granteeId: callerId,
          role,
        });
      }

      async function rawOwningOrgMembership(role: string) {
        const organizationId = await testApp.createOrganization();
        await testApp.addOrganizationMember(organizationId, ownerId, "owner");
        const experiment = await seedExperiment({ organizationId });
        await testApp.database
          .insert(organizationMembers)
          .values({ organizationId, userId: callerId, role });
        return experiment;
      }

      it.each([
        ["member", "none"],
        ["bogus", "none"],
        ["", "none"],
        ["viewer", "member"],
        ["viewer,bogus", "member"],
        ["bogus,admin", "member"],
      ] as const)("a grant role of %j reads as %s on both", async (role, expected) => {
        const experiment = await seedExperiment();
        await rawGrant(experiment.id, role);

        await expectAgreement(experiment.id, callerId, expected);
      });

      it.each([
        ["viewer", "none"],
        ["bogus", "none"],
        ["", "none"],
        ["member", "member"],
        ["member,bogus", "member"],
        ["bogus,admin", "member"],
      ] as const)("an owning-org role of %j reads as %s on both", async (role, expected) => {
        const experiment = await rawOwningOrgMembership(role);

        await expectAgreement(experiment.id, callerId, expected);
      });

      /**
       * A multi-role string written with a space after the comma. The evaluator trims
       * each token, so it must; splitting on the comma alone leaves ` admin` padded and
       * matching nothing, which is a list row and a detail read disagreeing — the one
       * thing this predicate exists to prevent.
       */
      it.each([
        ["viewer, admin", "member"],
        ["bogus, viewer", "member"],
        ["bogus, nonsense", "none"],
      ] as const)("a spaced grant role of %j reads as %s on both", async (role, expected) => {
        const experiment = await seedExperiment();
        await rawGrant(experiment.id, role);

        await expectAgreement(experiment.id, callerId, expected);
      });

      it.each([
        ["member, bogus", "member"],
        ["bogus, admin", "member"],
        ["bogus, viewer", "none"],
      ] as const)("a spaced owning-org role of %j reads as %s on both", async (role, expected) => {
        const experiment = await rawOwningOrgMembership(role);

        await expectAgreement(experiment.id, callerId, expected);
      });

      it("does not read a token with a space inside it as that role", async () => {
        // Trimmed at the boundaries only. Stripping every space would turn "ad min"
        // into `admin` and hand out access the evaluator refuses outright.
        const experiment = await seedExperiment();
        await rawGrant(experiment.id, "vie wer");

        await expectAgreement(experiment.id, callerId, "none");
      });
    });

    describe("the slices stay honest against each other", () => {
      it("member rows in `all` equal the `related` rows minus the authorship-only ones", async () => {
        const organizationId = await testApp.createOrganization();
        await testApp.addOrganizationMember(organizationId, ownerId, "owner");

        // One of each: a grant, an owning-org membership, authorship with no access
        // path, and a public row the caller has no relationship with at all.
        const granted = await seedExperiment();
        await testApp.addExperimentCollaborator(granted.id, callerId);

        await testApp.addOrganizationMember(organizationId, callerId, "member");
        const throughOrg = await seedExperiment({ organizationId });

        const strandedOrgId = await testApp.createOrganization();
        await testApp.addOrganizationMember(strandedOrgId, ownerId, "owner");
        const authoredOnly = await seedExperiment({
          createdBy: callerId,
          organizationId: strandedOrgId,
        });

        await seedExperiment();

        const all = await repository.findAll(callerId, "all");
        const related = await repository.findAll(callerId, "related");
        assertSuccess(all);
        assertSuccess(related);

        const members = all.value.filter((row) => row.membershipStatus === "member");
        const authorshipOnly = related.value.filter((row) => row.membershipStatus !== "member");

        expect(members.map((row) => row.id).sort()).toEqual([granted.id, throughOrg.id].sort());
        expect(authorshipOnly.map((row) => row.id)).toEqual([authoredOnly.id]);
        expect(members).toHaveLength(related.value.length - authorshipOnly.length);
      });

      it("carries the field on the paginated listing too", async () => {
        const experiment = await seedExperiment();
        await testApp.addExperimentCollaborator(experiment.id, callerId);

        const page = await repository.findPage(callerId, 1, 20, "all");

        assertSuccess(page);
        const row = page.value.items.find((entry) => entry.id === experiment.id);
        expect(row?.membershipStatus).toBe("member");
      });

      it("keeps list and access agreeing on an archived experiment", async () => {
        // Archived rows drop out of a default listing but stay readable by id, so the
        // two views have to agree for the caller who asks for them explicitly.
        const experiment = await seedExperiment();
        await testApp.addExperimentCollaborator(experiment.id, callerId);
        await testApp.database
          .update(experimentsTable)
          .set({ status: "archived" })
          .where(eq(experimentsTable.id, experiment.id));

        const listed = await repository.findAll(callerId, "all", "archived");
        const access = await repository.checkAccess(experiment.id, callerId);
        assertSuccess(listed);
        assertSuccess(access);

        const row = listed.value.find((entry) => entry.id === experiment.id);
        expect(row?.membershipStatus).toBe("member");
        expect(access.value.membershipStatus).toBe("member");
      });

      it("says none on an archived experiment the caller merely reads", async () => {
        const experiment = await seedExperiment();
        await testApp.database
          .update(experimentsTable)
          .set({ status: "archived" })
          .where(eq(experimentsTable.id, experiment.id));

        const listed = await repository.findAll(callerId, "all", "archived");
        const access = await repository.checkAccess(experiment.id, callerId);
        assertSuccess(listed);
        assertSuccess(access);

        const row = listed.value.find((entry) => entry.id === experiment.id);
        expect(row?.membershipStatus).toBe("none");
        expect(access.value.membershipStatus).toBe("none");
      });
    });
  });
});
