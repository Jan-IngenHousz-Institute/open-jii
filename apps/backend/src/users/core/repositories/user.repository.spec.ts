import { faker } from "@faker-js/faker";

import {
  users,
  macros as macrosTable,
  profiles,
  accounts,
  apiKeys,
  passkeys,
  sessions,
  experimentMembers,
  organizations,
  organizationMembers,
  personalOrgSlug,
  personalOrgName,
  ensurePersonalOrganization,
  and,
  createSecondaryDatabase,
  eq,
  inArray,
  resourceGrants,
  sql,
} from "@repo/database";
import type { DatabaseInstance } from "@repo/database";

import { assertFailure, assertSuccess } from "../../../common/utils/fp-utils";
import { CACHE_PORT } from "../../../macros/core/ports/cache.port";
import { MacroRepository } from "../../../macros/core/repositories/macro.repository";
import {
  livingOrgOwnerIdsSql,
  lockOrgOwnerships,
  lockStaffingGrants,
} from "../../../sharing/resource-staffing";
import { TestHarness } from "../../../test/test-harness";
import { UserRepository } from "./user.repository";

describe("UserRepository", () => {
  const testApp = TestHarness.App;
  let repository: UserRepository;
  let testUserId: string;

  /** A macro/protocol/workbook authored by `creatorId` (seeded with its creator grant). */
  const createAuthoredResource = (
    resourceType: "macro" | "protocol" | "workbook",
    creatorId: string,
  ) => {
    const name = `${resourceType} ${faker.string.uuid()}`;
    if (resourceType === "macro") return testApp.createMacro({ name, createdBy: creatorId });
    if (resourceType === "protocol") return testApp.createProtocol({ name, createdBy: creatorId });
    return testApp.createWorkbook({ name, createdBy: creatorId });
  };

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    repository = testApp.module.get(UserRepository);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("create", () => {
    it("should create a new user", async () => {
      // Arrange
      const createUserDto = {
        name: "John Doe",
        email: "john.doe@example.com",
        emailVerified: true,
        image: "https://example.com/avatar.jpg",
      };

      // Act
      const result = await repository.create(createUserDto);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const createdUsers = result.value;
      const user = createdUsers[0];

      expect(user).toMatchObject({
        id: expect.any(String) as string,
        name: createUserDto.name,
        email: createUserDto.email,
        emailVerified: createUserDto.emailVerified,
        image: createUserDto.image,
      });

      // Verify directly in database
      const dbResult = await testApp.database.select().from(users).where(eq(users.id, user.id));

      expect(dbResult.length).toBe(1);
      expect(dbResult[0]).toMatchObject({
        name: createUserDto.name,
        email: createUserDto.email,
        image: createUserDto.image,
      });
    });
  });

  describe("findOne", () => {
    it("should find a user by id", async () => {
      // Arrange
      const userEmail = faker.internet.email();
      const userId = await testApp.createTestUser({
        email: userEmail,
      });

      // Act
      const result = await repository.findOne(userId);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const user = result.value;
      expect(user).not.toBeNull();
      expect(user?.id).toBe(userId);
      expect(user?.email).toBe(userEmail);
    });

    it("should return null if user not found", async () => {
      // Arrange
      const nonExistentId = "00000000-0000-0000-0000-000000000000";

      // Act
      const result = await repository.findOne(nonExistentId);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toBeNull();
    });
  });

  describe("findByEmail", () => {
    it("should find a user by email", async () => {
      // Arrange
      const userEmail = faker.internet.email();
      const userId = await testApp.createTestUser({
        email: userEmail,
      });

      // Act
      const result = await repository.findByEmail(userEmail);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const user = result.value;
      expect(user).not.toBeNull();
      expect(user?.id).toBe(userId);
      expect(user?.email).toBe(userEmail);
    });

    it("should return null if user not found by email", async () => {
      // Arrange
      const nonExistentEmail = "nonexistent@example.com";

      // Act
      const result = await repository.findByEmail(nonExistentEmail);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toBeNull();
    });
  });

  describe("search", () => {
    it("should search users without any query parameters", async () => {
      // Arrange
      const user1Id = await testApp.createTestUser({
        name: "Alice Smith",
        email: "alice@example.com",
      });
      const user2Id = await testApp.createTestUser({
        name: "Bob Johnson",
        email: "bob@example.com",
      });

      // Act
      const result = await repository.search({});

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const foundUsers = result.value;
      expect(foundUsers.length).toBeGreaterThanOrEqual(3); // At least the 3 created users

      const userIds = foundUsers.map((u) => u.userId);
      expect(userIds).toContain(testUserId);
      expect(userIds).toContain(user1Id);
      expect(userIds).toContain(user2Id);
    });

    it("should search users by name", async () => {
      // Arrange
      await testApp.createTestUser({
        name: "Alice Smith",
        email: "alice@example.com",
      });
      await testApp.createTestUser({
        name: "Bob Johnson",
        email: "bob@example.com",
      });

      // Act
      const result = await repository.search({ query: "Alice" });

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const foundUsers = result.value;
      expect(foundUsers.length).toBe(1);
      expect(foundUsers[0].firstName).toBe("Alice");
      expect(foundUsers[0].lastName).toBe("Smith");
    });

    it("should search users by email", async () => {
      // Arrange
      await testApp.createTestUser({
        name: "Alice Smith",
        email: "alice@example.com",
      });
      await testApp.createTestUser({
        name: "Bob Johnson",
        email: "bob@example.com",
      });

      // Act
      const result = await repository.search({ query: "alice@example.com" });

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const foundUsers = result.value;
      expect(foundUsers.length).toBe(1);
      expect(foundUsers[0].email).toBe("alice@example.com");
    });

    it("should search users with partial name match", async () => {
      // Arrange
      await testApp.createTestUser({
        name: "Alice Smith",
        email: "alice@example.com",
      });
      await testApp.createTestUser({
        name: "Alice Johnson",
        email: "alice.johnson@example.com",
      });

      // Act
      const result = await repository.search({ query: "Alice" });

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const foundUsers = result.value;
      expect(foundUsers.length).toBe(2);
      expect(foundUsers.every((u) => u.firstName.includes("Alice"))).toBe(true);
    });

    it("should apply limit and offset for pagination", async () => {
      // Arrange
      const userIds: string[] = [];

      for (let i = 0; i < 5; i++) {
        const userId = await testApp.createTestUser({
          name: `User ${i}`,
          email: `user${i}@example.com`,
        });

        userIds.push(userId);
      }

      // Act - get first 2 users
      const firstPageResult = await repository.search({ limit: 2, offset: 0 });

      // Assert
      expect(firstPageResult.isSuccess()).toBe(true);
      assertSuccess(firstPageResult);
      const firstPageUsers = firstPageResult.value;
      expect(firstPageUsers.length).toBe(2);

      // Act - get next 2 users
      const secondPageResult = await repository.search({ limit: 2, offset: 2 });

      // Assert
      expect(secondPageResult.isSuccess()).toBe(true);
      assertSuccess(secondPageResult);
      const secondPageUsers = secondPageResult.value;
      expect(secondPageUsers.length).toBe(2);

      // Ensure no overlap
      const firstPageIds = firstPageUsers.map((u) => u.userId);
      const secondPageIds = secondPageUsers.map((u) => u.userId);
      expect(firstPageIds.some((id) => secondPageIds.includes(id))).toBe(false);
    });

    it("should return empty array if no users match the search query", async () => {
      // Act
      const result = await repository.search({ query: "nonexistentuser" });

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toEqual([]);
    });

    it("should search users by last name", async () => {
      await testApp.createTestUser({
        name: "Barnaby Figglesworth",
        email: "barnaby@example.com",
      });

      const result = await repository.search({ query: "figglesworth", limit: 20 });

      assertSuccess(result);
      expect(result.value.some((user) => user.lastName === "Figglesworth")).toBe(true);
    });

    it("should search users by an email substring", async () => {
      const userId = await testApp.createTestUser({
        name: "Zelda Quux",
        email: "zorptastic@example.com",
      });

      const result = await repository.search({ query: "zorptastic", limit: 20 });

      assertSuccess(result);
      expect(result.value.some((user) => user.userId === userId)).toBe(true);
    });

    it("should tolerate a typo via trigram matching", async () => {
      await testApp.createTestUser({
        name: "Maxwell Thornberry",
        email: "maxwell@example.com",
      });

      const result = await repository.search({ query: "thornbery", limit: 20 });

      assertSuccess(result);
      expect(result.value.some((user) => user.lastName === "Thornberry")).toBe(true);
    });

    it("should match a name prefix via substring search", async () => {
      await testApp.createTestUser({
        name: "Barnaby Figglesworth",
        email: "prefixcase@example.com",
      });

      const result = await repository.search({ query: "barn", limit: 20 });

      assertSuccess(result);
      expect(result.value.some((user) => user.firstName === "Barnaby")).toBe(true);
    });

    it("should exclude deactivated and soft-deleted users", async () => {
      await testApp.createTestUser({
        name: "Ghosty Inactive",
        email: "inactive@example.com",
        activated: false,
      });
      await testApp.createTestUser({
        name: "Removed Person",
        email: "removed@example.com",
        deletedAt: new Date(),
      });

      const inactiveResult = await repository.search({ query: "ghosty", limit: 20 });
      const deletedResult = await repository.search({ query: "removed", limit: 20 });

      assertSuccess(inactiveResult);
      assertSuccess(deletedResult);
      expect(inactiveResult.value.some((user) => user.firstName === "Ghosty")).toBe(false);
      expect(deletedResult.value.some((user) => user.firstName === "Removed")).toBe(false);
    });

    it("excludes deactivated and soft-deleted users from the no-query listing too", async () => {
      const inactive = await testApp.createTestUser({
        name: "Ghosty Inactive",
        email: "inactive-noquery@example.com",
        activated: false,
      });
      const removed = await testApp.createTestUser({
        name: "Removed Person",
        email: "removed-noquery@example.com",
        deletedAt: new Date(),
      });

      // The empty-query branch previously applied no visibility predicates at
      // all, listing every profile including deactivated/soft-deleted ones.
      const result = await repository.search({ limit: 100 });

      assertSuccess(result);
      const ids = result.value.map((u) => u.userId);
      expect(ids).not.toContain(inactive);
      expect(ids).not.toContain(removed);
      expect(ids).toContain(testUserId);
    });
  });

  describe("update", () => {
    it("should update a user", async () => {
      // Arrange
      const updateData = {
        name: "Updated Name",
        image: "https://example.com/new-avatar.jpg",
      };

      // Act
      const result = await repository.update(testUserId, updateData);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const updatedUsers = result.value;
      const updatedUser = updatedUsers[0];

      expect(updatedUser).toMatchObject({
        id: testUserId,
        name: updateData.name,
        image: updateData.image,
      });

      // Verify in database
      const dbResult = await testApp.database.select().from(users).where(eq(users.id, testUserId));

      expect(dbResult[0]).toMatchObject(updateData);
    });
  });

  describe("isOnlyAdminOfAnyResources", () => {
    it("should return false when user is not an admin of any experiments", async () => {
      // Arrange
      const userId = await testApp.createTestUser({
        email: "nonadmin@example.com",
      });

      // Act
      const result = await repository.isOnlyAdminOfAnyResources(userId);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toBe(false);
    });

    it("should return false when user is admin but other admins exist", async () => {
      // Arrange
      const admin1Id = await testApp.createTestUser({
        email: "admin1@example.com",
      });
      const admin2Id = await testApp.createTestUser({
        email: "admin2@example.com",
      });

      const { experiment } = await testApp.createExperiment({
        name: "Shared Admin Experiment",
        userId: admin1Id,
      });

      // Add second admin (first admin is added automatically by createExperiment)
      await testApp.addExperimentAdmin(experiment.id, admin2Id);

      // Act
      const result = await repository.isOnlyAdminOfAnyResources(admin1Id);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toBe(false);
    });

    it("should return true when user is the only admin of an experiment", async () => {
      // Arrange
      const soloAdminId = await testApp.createTestUser({
        email: "soloadmin@example.com",
      });
      const memberId = await testApp.createTestUser({
        email: "member@example.com",
      });

      const { experiment } = await testApp.createExperiment({
        name: "Solo Admin Experiment",
        userId: soloAdminId,
      });

      // Add a regular member (solo admin is already added by createExperiment)
      await testApp.addExperimentCollaborator(experiment.id, memberId);

      // Act
      const result = await repository.isOnlyAdminOfAnyResources(soloAdminId);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toBe(true);
    });

    it("should return true when user is sole admin of at least one experiment among many", async () => {
      // Arrange
      const userId = await testApp.createTestUser({
        email: "multiadmin@example.com",
      });
      const otherAdminId = await testApp.createTestUser({
        email: "otheradmin@example.com",
      });

      // Experiment 1: user is sole admin
      await testApp.createExperiment({
        name: "Sole Admin Experiment",
        userId: userId,
      });

      // Experiment 2: user shares admin role
      const { experiment: experiment2 } = await testApp.createExperiment({
        name: "Shared Admin Experiment",
        userId: userId,
      });
      await testApp.addExperimentAdmin(experiment2.id, otherAdminId);

      // Act
      const result = await repository.isOnlyAdminOfAnyResources(userId);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toBe(true);
    });

    it("should return true when the only other admin is deactivated", async () => {
      // Arrange
      const activeAdminId = await testApp.createTestUser({
        email: "activeadmin@example.com",
      });
      const deactivatedAdminId = await testApp.createTestUser({
        email: "deactivatedadmin@example.com",
        activated: false,
      });

      const { experiment } = await testApp.createExperiment({
        name: "Deactivated Co-Admin Experiment",
        userId: activeAdminId,
      });

      // A second admin exists but is deactivated, so the active user is effectively the sole
      // admin and deletion must stay blocked.
      await testApp.addExperimentAdmin(experiment.id, deactivatedAdminId);

      // Act
      const result = await repository.isOnlyAdminOfAnyResources(activeAdminId);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toBe(true);
    });

    it("should return false when user is only a member, not an admin", async () => {
      // Arrange
      const adminId = await testApp.createTestUser({
        email: "admin@example.com",
      });
      const memberId = await testApp.createTestUser({
        email: "justmember@example.com",
      });

      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment",
        userId: adminId,
      });

      // Add member (admin is already added by createExperiment)
      await testApp.addExperimentCollaborator(experiment.id, memberId);

      // Act
      const result = await repository.isOnlyAdminOfAnyResources(memberId);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toBe(false);
    });

    // The query moved from `experiment_members.role='admin'` to direct admin/owner
    // user grants. These pin down the edges of that source.
    it("ignores an organization grant — it is not an answerable owner", async () => {
      const soloAdminId = await testApp.createTestUser({ email: "solo-org@example.com" });
      const orgMemberId = await testApp.createTestUser({ email: "org-member@example.com" });

      const { experiment } = await testApp.createExperiment({
        name: "Org-granted Experiment",
        userId: soloAdminId,
      });
      const orgId = await testApp.createOrganization();
      await testApp.addOrganizationMember(orgId, orgMemberId, "admin");
      await testApp.addResourceGrant({
        resourceType: "experiment",
        resourceId: experiment.id,
        granteeType: "organization",
        granteeId: orgId,
        role: "admin",
      });

      // The org grant confers admin capability through can(), but it does not make
      // any individual accountable, so the sole admin stays blocked.
      const soleAdmin = await repository.isOnlyAdminOfAnyResources(soloAdminId);
      assertSuccess(soleAdmin);
      expect(soleAdmin.value).toBe(true);

      // ...and it does not turn the org's members into blocked admins either.
      const viaOrg = await repository.isOnlyAdminOfAnyResources(orgMemberId);
      assertSuccess(viaOrg);
      expect(viaOrg.value).toBe(false);
    });

    it("does not count a contributing collaborator as an admin", async () => {
      const soloAdminId = await testApp.createTestUser({ email: "solo-mirror@example.com" });
      const contributorId = await testApp.createTestUser({ email: "mirror@example.com" });

      const { experiment } = await testApp.createExperiment({
        name: "Contributor Only Experiment",
        userId: soloAdminId,
      });
      // A `member` grant contributes; only `admin`/`owner` staff an experiment, so
      // this collaborator is not what stands between it and having no admin.
      await testApp.addExperimentCollaborator(experiment.id, contributorId);

      const result = await repository.isOnlyAdminOfAnyResources(contributorId);
      assertSuccess(result);
      expect(result.value).toBe(false);

      const soleAdmin = await repository.isOnlyAdminOfAnyResources(soloAdminId);
      assertSuccess(soleAdmin);
      expect(soleAdmin.value).toBe(true);
    });

    // The blocker covers all four shareable types: each is created with a creator
    // admin grant, so each can be left with nobody answerable for it.
    it.each(["macro", "protocol", "workbook"] as const)(
      "blocks on a sole-admin %s, and stops blocking once a second admin exists",
      async (resourceType) => {
        const creatorId = await testApp.createTestUser({ email: `${resourceType}@example.com` });
        const resource = await createAuthoredResource(resourceType, creatorId);

        const blocked = await repository.isOnlyAdminOfAnyResources(creatorId);
        assertSuccess(blocked);
        expect(blocked.value).toBe(true);

        const coAdminId = await testApp.createTestUser({
          email: `${resourceType}-co-admin@example.com`,
        });
        await testApp.addResourceAdmin(resourceType, resource.id, coAdminId);

        const cleared = await repository.isOnlyAdminOfAnyResources(creatorId);
        assertSuccess(cleared);
        expect(cleared.value).toBe(false);
      },
    );

    it("blocks on a 'member,owner' membership, which the matrix reads as ownership", async () => {
      const org = await testApp.createOrganization();
      const multiOwner = await testApp.createTestUser({ email: "multi-owner@example.com" });
      // Better Auth stores multi-roles comma-separated, and `can()` accepts the row
      // if any token grants — so this person owns the org as far as access goes. A
      // blocker matching the role by string equality would let them delete and strip
      // the macro of its only owner.
      await testApp.addOrganizationMember(org, multiOwner, "member,owner" as "owner");
      await testApp.createMacro({
        name: `Multi ${faker.string.uuid()}`,
        createdBy: multiOwner,
        organizationId: org,
      });

      const result = await repository.isOnlyAdminOfAnyResources(multiOwner);
      assertSuccess(result);
      expect(result.value).toBe(true);
    });

    it("does not let a device grant block a deletion", async () => {
      const ownerId = await testApp.createTestUser({ email: "device-owner@example.com" });
      const device = await testApp.createIotDevice({ createdBy: ownerId });
      // Devices have no sharing surface and no staffing rules, so an admin grant on
      // one must never stand between a user and closing their account.
      await testApp.addResourceGrant({
        resourceType: "device",
        resourceId: device.id,
        granteeType: "user",
        granteeId: ownerId,
        role: "admin",
      });

      const result = await repository.isOnlyAdminOfAnyResources(ownerId);
      assertSuccess(result);
      expect(result.value).toBe(false);
    });
  });

  describe("delete", () => {
    it("should soft-delete a user and scrub PII", async () => {
      // Arrange
      const userToDeleteId = await testApp.createTestUser({
        name: "User to Delete",
        email: "delete@example.com",
      });

      // Act
      const result = await repository.delete(userToDeleteId);

      // Assert result
      expect(result.isSuccess()).toBe(true);

      // Verify user row still exists but PII is scrubbed and deletedAt is set
      const userRows = await testApp.database
        .select()
        .from(users)
        .where(eq(users.id, userToDeleteId));
      expect(userRows.length).toBe(1);
      const userRow = userRows[0];
      expect(userRow.email).not.toBe("delete@example.com"); // Email is anonymized, not null
      expect(userRow.email).toMatch(/^deleted-/); // Starts with deleted- prefix
      expect(userRow.image).toBeNull();
      expect(userRow.emailVerified).toBe(false); // NOT NULL constraint, defaults to false
      expect(userRow.name).toBe("Deleted User");

      // Verify related PII rows are removed
      const accountRows = await testApp.database
        .select()
        .from(accounts)
        .where(eq(accounts.userId, userToDeleteId));
      expect(accountRows.length).toBe(0);

      const sessionRows = await testApp.database
        .select()
        .from(sessions)
        .where(eq(sessions.userId, userToDeleteId));
      expect(sessionRows.length).toBe(0);

      // Profile should be anonymized, not deleted
      const profs = await testApp.database
        .select()
        .from(profiles)
        .where(eq(profiles.userId, userToDeleteId));
      expect(profs.length).toBe(1);
      const profile = profs[0];
      expect(profile.firstName).toBe("Deleted");
      expect(profile.lastName).toBe("User");
      expect(profile.bio).toBeNull();
      expect(profile.avatarUrl).toBeNull();
      expect(profile.deletedAt).not.toBeNull();

      // Experiment memberships for this user should be deleted
      const memberships = await testApp.database
        .select()
        .from(experimentMembers)
        .where(eq(experimentMembers.userId, userToDeleteId));
      expect(memberships.length).toBe(0);
    });

    it("revokes API keys and passkeys when soft-deleting a user", async () => {
      const userToDeleteId = await testApp.createTestUser({
        name: "Credential Owner",
        email: "credential-owner@example.com",
      });
      await testApp.database.insert(apiKeys).values({
        name: "Automation",
        key: "hashed-api-key",
        referenceId: userToDeleteId,
      });
      await testApp.database.insert(passkeys).values({
        name: "Work laptop",
        publicKey: "public-key",
        userId: userToDeleteId,
        credentialID: faker.string.uuid(),
        deviceType: "singleDevice",
      });

      const result = await repository.delete(userToDeleteId);
      expect(result.isSuccess()).toBe(true);

      const remainingApiKeys = await testApp.database
        .select()
        .from(apiKeys)
        .where(eq(apiKeys.referenceId, userToDeleteId));
      const remainingPasskeys = await testApp.database
        .select()
        .from(passkeys)
        .where(eq(passkeys.userId, userToDeleteId));
      expect(remainingApiKeys).toHaveLength(0);
      expect(remainingPasskeys).toHaveLength(0);
    });

    it("anonymizes the personal organization name so it no longer embeds PII", async () => {
      // Arrange: a user whose personal org name embeds their real name.
      const userToDeleteId = await testApp.createTestUser({
        name: "Jane Secret",
        email: "jane.secret@example.com",
      });
      const orgId = await ensurePersonalOrganization(testApp.database, {
        id: userToDeleteId,
        name: "Jane Secret",
      });
      const [before] = await testApp.database
        .select()
        .from(organizations)
        .where(eq(organizations.id, orgId));
      expect(before.name).toBe("Jane Secret's workspace");

      // Act
      const result = await repository.delete(userToDeleteId);
      expect(result.isSuccess()).toBe(true);

      // Assert: name scrubbed of PII; org (and ownership) intentionally kept.
      const [after] = await testApp.database
        .select()
        .from(organizations)
        .where(eq(organizations.id, orgId));
      expect(after.name).toBe(personalOrgName("Deleted User"));
      expect(after.name).not.toContain("Jane");
      expect(after.name).not.toContain("Secret");

      const members = await testApp.database
        .select()
        .from(organizationMembers)
        .where(eq(organizationMembers.organizationId, orgId));
      expect(members).toHaveLength(1);
      expect(members[0].userId).toBe(userToDeleteId);
    });
  });

  describe("createOrUpdateUserProfile", () => {
    it("should create a new user profile", async () => {
      // A user with no profile yet, so this exercises the create branch.
      const newUserId = await testApp.createTestUser({ createProfile: false });
      const dto = {
        firstName: "Alice",
        lastName: "Smith",
      };

      const result = await repository.createOrUpdateUserProfile(newUserId, dto);

      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toMatchObject({
        firstName: dto.firstName,
        lastName: dto.lastName,
      });

      // Check profile was created
      const profs = await testApp.database
        .select()
        .from(profiles)
        .where(eq(profiles.userId, newUserId));
      expect(profs.length).toBe(1);
      expect(profs[0].firstName).toBe(dto.firstName);

      // Creating the profile names the user's personal org from first + last
      // and makes them its owner.
      const [org] = await testApp.database
        .select()
        .from(organizations)
        .where(eq(organizations.slug, personalOrgSlug(newUserId)));
      expect(org.name).toBe("Alice Smith's workspace");

      const members = await testApp.database
        .select()
        .from(organizationMembers)
        .where(eq(organizationMembers.organizationId, org.id));
      expect(members).toHaveLength(1);
      expect(members[0].role).toBe("owner");
    });

    it("should update an existing user profile", async () => {
      // First, create a profile
      const initialDto = {
        firstName: "Bob",
        lastName: "Jones",
      };
      await repository.createOrUpdateUserProfile(testUserId, initialDto);

      // Now, update the profile
      const updateDto = {
        firstName: "Robert",
        lastName: "Jones",
      };
      const result = await repository.createOrUpdateUserProfile(testUserId, updateDto);

      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value.firstName).toBe("Robert");

      // Check profile was updated
      const profs = await testApp.database
        .select()
        .from(profiles)
        .where(eq(profiles.userId, testUserId));
      expect(profs.length).toBe(1);
      expect(profs[0].firstName).toBe("Robert");

      // Cleanup
    });

    it("should create a user profile without optional fields", async () => {
      const dto = {
        firstName: "Charlie",
        lastName: "Brown",
      };

      const result = await repository.createOrUpdateUserProfile(testUserId, dto);

      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toMatchObject({
        firstName: dto.firstName,
        lastName: dto.lastName,
      });

      // Check profile was created
      const profs = await testApp.database
        .select()
        .from(profiles)
        .where(eq(profiles.userId, testUserId));
      expect(profs.length).toBe(1);
      expect(profs[0].firstName).toBe(dto.firstName);
    });

    it("should create a user profile with bio", async () => {
      const dto = {
        firstName: "John",
        lastName: "Smith",
        bio: "Software engineer with 10 years of experience.",
      };

      const result = await repository.createOrUpdateUserProfile(testUserId, dto);

      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toMatchObject({
        firstName: dto.firstName,
        lastName: dto.lastName,
        bio: dto.bio,
      });

      // Check profile was created with bio
      const profs = await testApp.database
        .select()
        .from(profiles)
        .where(eq(profiles.userId, testUserId));
      expect(profs.length).toBe(1);
      expect(profs[0].bio).toBe(dto.bio);
    });
  });

  describe("findUsersByIds", () => {
    let testUser1Id: string;
    let testUser2Id: string;
    let testUser3Id: string;

    beforeEach(async () => {
      // Create additional test users
      testUser1Id = await testApp.createTestUser({
        email: "finduser1@example.com",
        name: "Find User 1",
        image: null,
      });
      testUser2Id = await testApp.createTestUser({
        email: "finduser2@example.com",
        name: "Find User 2",
        image: null,
      });
      testUser3Id = await testApp.createTestUser({
        email: "finduser3@example.com",
        name: "Find User 3",
        image: "https://example.com/avatar3.jpg",
        createProfile: false, // Don't create profile for this user
      });

      // Create profiles for users 1 and 2, but not 3
      await repository.createOrUpdateUserProfile(testUser1Id, {
        firstName: "Find",
        lastName: "User1",
        bio: "Test bio 1",
        activated: true,
      });
      await repository.createOrUpdateUserProfile(testUser2Id, {
        firstName: "Find",
        lastName: "User2",
        bio: "Test bio 2",
        activated: true,
      });
    });

    it("should return user metadata for valid user IDs", async () => {
      // Act
      const result = await repository.findUsersByIds([testUser1Id, testUser2Id]);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toHaveLength(2);

      // Check first user
      const user1 = result.value.find((u) => u.userId === testUser1Id);
      expect(user1).toBeDefined();
      expect(user1).toMatchObject({
        userId: testUser1Id,
        firstName: "Find",
        lastName: "User1",
        avatarUrl: null,
      });

      // Check second user
      const user2 = result.value.find((u) => u.userId === testUser2Id);
      expect(user2).toBeDefined();
      expect(user2).toMatchObject({
        userId: testUser2Id,
        firstName: "Find",
        lastName: "User2",
        avatarUrl: null,
      });
    });

    it("should return empty array for empty user IDs array", async () => {
      // Act
      const result = await repository.findUsersByIds([]);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toEqual([]);
    });

    it("should exclude users without profiles (inner join)", async () => {
      // Act - include user without profile
      const result = await repository.findUsersByIds([testUser3Id]);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toHaveLength(0); // User without profile is excluded by inner join
    });

    it("should only return users with profiles (inner join)", async () => {
      // Act - request both user with profile and user without profile
      const result = await repository.findUsersByIds([testUser1Id, testUser3Id]);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toHaveLength(1); // Only user with profile is returned

      // User with profile
      const userWithProfile = result.value.find((u) => u.userId === testUser1Id);
      expect(userWithProfile).toMatchObject({
        userId: testUser1Id,
        firstName: "Find",
        lastName: "User1",
        avatarUrl: null,
      });

      // User without profile should not be included
      const userWithoutProfile = result.value.find((u) => u.userId === testUser3Id);
      expect(userWithoutProfile).toBeUndefined();
    });

    it("should return partial results for mix of valid and invalid user IDs", async () => {
      const invalidUserId = faker.string.uuid();

      // Act
      const result = await repository.findUsersByIds([testUser1Id, invalidUserId, testUser2Id]);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toHaveLength(2); // Only valid users with profiles returned

      const userIds = result.value.map((u) => u.userId);
      expect(userIds).toContain(testUser1Id);
      expect(userIds).toContain(testUser2Id);
      expect(userIds).not.toContain(invalidUserId);
    });

    it("should return empty array for all invalid user IDs", async () => {
      const invalidUserIds = [faker.string.uuid(), faker.string.uuid()];

      // Act
      const result = await repository.findUsersByIds(invalidUserIds);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toEqual([]);
    });

    it("should ignore malformed (non-uuid) user IDs without erroring", async () => {
      // A non-uuid id would otherwise raise a Postgres uuid cast error and fail
      // the whole batch.
      const result = await repository.findUsersByIds([testUser1Id, "dev-user"]);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toHaveLength(1);
      expect(result.value[0]?.userId).toBe(testUser1Id);
    });

    it("should handle duplicate user IDs", async () => {
      // Act - pass duplicate user IDs
      const result = await repository.findUsersByIds([testUser1Id, testUser1Id, testUser2Id]);

      // Assert - should return each user only once
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toHaveLength(2);

      const userIds = result.value.map((u) => u.userId);
      expect(userIds.filter((id) => id === testUser1Id)).toHaveLength(1);
      expect(userIds.filter((id) => id === testUser2Id)).toHaveLength(1);
    });
  });

  describe("findWhatsNewLastSeen", () => {
    it("should return null when the user has never opened the What's new panel", async () => {
      // Act
      const result = await repository.findWhatsNewLastSeen(testUserId);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toBeNull();
    });

    it("should return the stored timestamp when the user has opened the panel before", async () => {
      // Arrange: stamp a last-seen timestamp directly in the database
      const lastSeenAt = new Date("2026-01-15T10:30:00.000Z");
      await testApp.database
        .update(profiles)
        .set({ whatsNewLastSeenAt: lastSeenAt })
        .where(eq(profiles.userId, testUserId));

      // Act
      const result = await repository.findWhatsNewLastSeen(testUserId);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toBeInstanceOf(Date);
      expect(result.value?.getTime()).toBe(lastSeenAt.getTime());
    });

    it("should return null when the user has no profile row", async () => {
      // Arrange
      const userWithoutProfileId = await testApp.createTestUser({
        createProfile: false,
      });

      // Act
      const result = await repository.findWhatsNewLastSeen(userWithoutProfileId);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toBeNull();
    });
  });

  describe("markWhatsNewSeen", () => {
    it("should stamp the last-seen timestamp and return it", async () => {
      // Act
      const result = await repository.markWhatsNewSeen(testUserId);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toBeInstanceOf(Date);

      // Verify the timestamp was persisted in the database
      const profs = await testApp.database
        .select()
        .from(profiles)
        .where(eq(profiles.userId, testUserId));
      expect(profs.length).toBe(1);
      expect(profs[0].whatsNewLastSeenAt).not.toBeNull();
      expect(profs[0].whatsNewLastSeenAt?.getTime()).toBe(result.value?.getTime());
    });

    it("should overwrite an existing last-seen timestamp with a newer one", async () => {
      // Arrange: stamp an old last-seen timestamp directly in the database
      const previousSeenAt = new Date("2020-01-01T00:00:00.000Z");
      await testApp.database
        .update(profiles)
        .set({ whatsNewLastSeenAt: previousSeenAt })
        .where(eq(profiles.userId, testUserId));

      // Act
      const result = await repository.markWhatsNewSeen(testUserId);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toBeInstanceOf(Date);
      expect(result.value?.getTime()).toBeGreaterThan(previousSeenAt.getTime());
    });

    it("should return null when the user has no profile row", async () => {
      // Arrange
      const userWithoutProfileId = await testApp.createTestUser({
        createProfile: false,
      });

      // Act
      const result = await repository.markWhatsNewSeen(userWithoutProfileId);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toBeNull();
    });
  });

  /**
   * The sole-admin blocker in `DeleteUserUseCase` runs *outside* the deletion
   * transaction, so on its own it is raceable: the last two admins of an experiment
   * deleting concurrently would both observe a second admin and both commit, leaving
   * the experiment unstaffed. `delete` re-checks inside its transaction under the
   * same `SELECT … FOR UPDATE` the sharing guard uses.
   *
   * Verified to have teeth: removing the in-transaction guard makes three of the
   * four cases below fail, the race included.
   */
  describe("delete re-checks the sole-admin invariant inside its transaction", () => {
    const staffingGrantCount = async (
      resourceId: string,
      resourceType: "experiment" | "macro" | "protocol" | "workbook" = "experiment",
    ) => {
      const rows = await testApp.database
        .select({ id: resourceGrants.id })
        .from(resourceGrants)
        .where(
          and(
            eq(resourceGrants.resourceType, resourceType),
            eq(resourceGrants.resourceId, resourceId),
            eq(resourceGrants.granteeType, "user"),
            inArray(resourceGrants.role, ["owner", "admin"]),
          ),
        );
      return rows.length;
    };

    /** Whether the account survived the attempt untouched. */
    const isStillLive = async (userId: string) => {
      const [row] = await testApp.database
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, userId));
      return row.name !== "Deleted User";
    };

    // Prong (a): the user is the sole living owner of the org that owns the
    // resource, and nobody else holds a full-control grant on it.
    it("refuses a deletion that would leave an experiment with no answerable owner", async () => {
      const soleOwner = await testApp.createTestUser({ email: "solo-n2@example.com" });
      await testApp.createExperiment({ name: "Solo Owner N2", userId: soleOwner });

      // The pre-flight blocker is bypassed here on purpose — this asserts the
      // in-transaction guard is itself sufficient.
      const result = await repository.delete(soleOwner);

      assertFailure(result);
      expect(result.error.message).toContain("only admin");
      // Nothing was applied: the whole transaction rolled back.
      expect(await isStillLive(soleOwner)).toBe(true);
    });

    // The re-check is polymorphic over all four types, so a sole-owned macro is as
    // unclearable a blocker as a sole-owned experiment.
    it.each(["macro", "protocol", "workbook"] as const)(
      "refuses a deletion that would leave a %s with no answerable owner",
      async (resourceType) => {
        const soleOwner = await testApp.createTestUser({
          email: `solo-${resourceType}-n2@example.com`,
        });
        await createAuthoredResource(resourceType, soleOwner);

        const result = await repository.delete(soleOwner);

        assertFailure(result);
        expect(result.error.message).toContain("only admin");
        expect(await isStillLive(soleOwner)).toBe(true);
      },
    );

    // Prong (b): the husk chain. Handing admin off lets the owner leave, but it
    // makes the recipient answerable in turn — so their own deletion is refused
    // until they pass it on. Without this the chain would break and the resource
    // would end up with nobody at all.
    it("blocks the transferee's own deletion once the owner is gone", async () => {
      const originalOwner = await testApp.createTestUser({ email: "handing-off@example.com" });
      const { experiment } = await testApp.createExperiment({
        name: "Hand-off Chain",
        userId: originalOwner,
      });
      const transferee = await testApp.createTestUser({ email: "transferee@example.com" });
      await testApp.addResourceGrant({
        resourceType: "experiment",
        resourceId: experiment.id,
        granteeType: "user",
        granteeId: transferee,
        role: "admin",
      });

      // The owner may go: somebody else holds full control now.
      assertSuccess(await repository.delete(originalOwner));

      // ...which leaves the org a husk, so the transferee is now the only person
      // in full control and is blocked in exactly the same way.
      const result = await repository.delete(transferee);
      assertFailure(result);
      expect(result.error.message).toContain("only admin");
      expect(await isStillLive(transferee)).toBe(true);
      expect(await staffingGrantCount(experiment.id)).toBe(1);
    });

    it("lets the transferee go once they have handed on in turn", async () => {
      const originalOwner = await testApp.createTestUser({ email: "handing-off-2@example.com" });
      const { experiment } = await testApp.createExperiment({
        name: "Hand-off Chain 2",
        userId: originalOwner,
      });
      const transferee = await testApp.createTestUser({ email: "transferee-2@example.com" });
      const successor = await testApp.createTestUser({ email: "successor-2@example.com" });
      for (const granteeId of [transferee, successor]) {
        await testApp.addResourceGrant({
          resourceType: "experiment",
          resourceId: experiment.id,
          granteeType: "user",
          granteeId,
          role: "admin",
        });
      }

      assertSuccess(await repository.delete(originalOwner));
      assertSuccess(await repository.delete(transferee));

      // The successor is what the experiment is left with — never nobody.
      expect(await staffingGrantCount(experiment.id)).toBe(1);
    });

    it("allows a deletion while another activated admin remains", async () => {
      const leaving = await testApp.createTestUser({ email: "leaving-n2@example.com" });
      const { experiment } = await testApp.createExperiment({
        name: "Co-admin N2",
        userId: leaving,
      });
      const coAdmin = await testApp.createTestUser({ email: "co-admin-n2@example.com" });
      await testApp.addResourceGrant({
        resourceType: "experiment",
        resourceId: experiment.id,
        granteeType: "user",
        granteeId: coAdmin,
        role: "admin",
      });

      assertSuccess(await repository.delete(leaving));

      // The remaining admin keeps the experiment staffed.
      expect(await staffingGrantCount(experiment.id)).toBe(1);
    });

    it("refuses when the only other admin is deactivated", async () => {
      const activeAdmin = await testApp.createTestUser({ email: "active-n2@example.com" });
      const { experiment } = await testApp.createExperiment({
        name: "Deactivated Co-admin N2",
        userId: activeAdmin,
      });
      const deactivated = await testApp.createTestUser({
        email: "deactivated-n2@example.com",
        activated: false,
      });
      await testApp.addResourceGrant({
        resourceType: "experiment",
        resourceId: experiment.id,
        granteeType: "user",
        granteeId: deactivated,
        role: "admin",
      });

      // Same rule as the pre-flight check: a deactivated account cannot administer
      // an experiment, so it does not keep one staffed.
      const result = await repository.delete(activeAdmin);

      assertFailure(result);
      expect(result.error.message).toContain("only admin");
    });

    /**
     * Block until some backend is waiting on a lock. Both cases below hold the
     * organization's owner rows from a third connection and assert the operation
     * under test *stops* — which is the only way to prove it takes that lock at
     * all. Racing the two operations directly proves nothing: they interleave at
     * await points, so a run can serialize itself by accident and pass with no
     * locking whatsoever (verified — the earlier version of these tests did).
     */
    /** The backend PID a `max: 1` connection will run everything on. */
    const backendPidOf = async (db: DatabaseInstance) => {
      const [{ pid }] = await db.execute<{ pid: number }>(sql`SELECT pg_backend_pid() AS pid`);
      return Number(pid);
    };

    /**
     * Wait until **that specific backend** is waiting on a lock. Scoped to the PID
     * rather than "anything in this database": the harness and the holder are also
     * connected, so an unscoped count can be satisfied by an unrelated waiter and
     * the assertion passes without the subject ever blocking.
     */
    const waitUntilBlocked = async (pid: number) => {
      for (let attempt = 0; attempt < 100; attempt++) {
        const [{ waiting }] = await testApp.database.execute<{ waiting: number }>(
          sql`SELECT count(*)::int AS waiting FROM pg_stat_activity
              WHERE pid = ${pid} AND wait_event_type = 'Lock'`,
        );
        if (Number(waiting) > 0) return;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      throw new Error(`backend ${pid} never blocked on the organization's owner lock`);
    };

    /**
     * Hold an organization's owner rows until the returned `release` is called.
     * `held` resolves only once the lock is actually taken, so a caller can start
     * the subject operation knowing it must contend rather than hoping it does.
     */
    const holdOrgOwnerLock = async (db: DatabaseInstance, organizationId: string) => {
      let release!: () => void;
      let acquired!: () => void;
      const released = new Promise<void>((resolve) => {
        release = resolve;
      });
      const held = new Promise<void>((resolve) => {
        acquired = resolve;
      });
      const holding = db.transaction(async (tx) => {
        await lockOrgOwnerships(tx, organizationId);
        acquired();
        await released;
      });
      await held;
      return { release, holding };
    };

    // Owner-only resources have no staffing grants at all, so the grant locks are
    // empty and serialize nothing. The organization's owner-membership rows are the
    // stable anchor both sides take instead — these two cases are what it is for.
    it("waits on the organization's owner lock, so co-owners cannot both step away", async () => {
      const blocker = createSecondaryDatabase();
      const deleter = createSecondaryDatabase();
      try {
        const deleterRepo = new UserRepository(deleter.database);

        const org = await testApp.createOrganization();
        const ownerA = await testApp.createTestUser({ email: "co-owner-a@example.com" });
        const ownerB = await testApp.createTestUser({ email: "co-owner-b@example.com" });
        await testApp.addOrganizationMember(org, ownerA, "owner");
        await testApp.addOrganizationMember(org, ownerB, "owner");
        const macro = await testApp.createMacro({
          name: `Co-owned ${faker.string.uuid()}`,
          createdBy: ownerA,
          organizationId: org,
        });
        // Owned outright: nobody holds a grant on it, so there is nothing for the
        // per-resource lock to take.
        expect(await staffingGrantCount(macro.id, "macro")).toBe(0);

        const deleterPid = await backendPidOf(deleter.database);
        const { release, holding } = await holdOrgOwnerLock(blocker.database, org);
        const deletion = deleterRepo.delete(ownerA);
        await waitUntilBlocked(deleterPid);

        release();
        await holding;
        assertSuccess(await deletion);

        // With A gone, B is the sole living owner of the organization that owns the
        // macro, and nobody else administers it — so B is now refused. Without the
        // lock above the two could have decided simultaneously and both left.
        const second = await repository.delete(ownerB);
        assertFailure(second);
        expect(second.error.message).toContain("only admin");
      } finally {
        await Promise.all([blocker.close(), deleter.close()]);
      }
    });

    it("makes resource creation wait on the same lock", async () => {
      const blocker = createSecondaryDatabase();
      const creator = createSecondaryDatabase();
      try {
        const creatorRepo = new MacroRepository(creator.database, testApp.module.get(CACHE_PORT));

        const soleOwner = await testApp.createTestUser({ email: "racing-create@example.com" });
        const personalOrg = await testApp.personalOrganizationId(soleOwner);

        const creatorPid = await backendPidOf(creator.database);
        const { release, holding } = await holdOrgOwnerLock(blocker.database, personalOrg);
        const creation = creatorRepo.create(
          {
            name: `Raced ${faker.string.uuid()}`,
            description: "d",
            language: "python",
            code: "eA==",
          },
          soleOwner,
          personalOrg,
        );
        // Creation takes the same anchor the deletion guard does — that ordering is
        // what makes the two cases below the only two possible outcomes.
        await waitUntilBlocked(creatorPid);

        release();
        await holding;
        assertSuccess(await creation);
      } finally {
        await Promise.all([blocker.close(), creator.close()]);
      }
    });

    /**
     * The deletion-first order, end to end. The lock orders the two operations; this
     * is what happens on the side of it where the deletion won.
     *
     * The two are not raced directly here. They contend for the same rows by
     * construction, so releasing them together decides the winner non-deterministically
     * — and the ordering itself is already pinned by the blocking assertions above.
     * What needs proving is the *outcome* once the deletion has committed, which is
     * exactly this sequence.
     */
    it("refuses a create from an account whose deletion already committed", async () => {
      const creator = createSecondaryDatabase();
      try {
        const creatorRepo = new MacroRepository(creator.database, testApp.module.get(CACHE_PORT));

        const soleOwner = await testApp.createTestUser({
          email: "deleted-then-creates@example.com",
        });
        const personalOrg = await testApp.personalOrganizationId(soleOwner);
        // Owns nothing yet, so the blocker lets the deletion through.
        assertSuccess(await repository.delete(soleOwner));

        const creation = await creatorRepo.create(
          {
            name: `Posthumous ${faker.string.uuid()}`,
            description: "d",
            language: "python",
            code: "eA==",
          },
          soleOwner,
          personalOrg,
        );

        // Their workspace is a husk, so nobody inherits control and the only
        // candidate is the creator — who no longer exists. Granting admin to a
        // closed account would leave the macro with no living owner *and* no living
        // admin, so the create is refused instead.
        assertFailure(creation);
        expect(creation.error.message).toContain("closed account");

        const [macroRow] = await testApp.database
          .select({ id: macrosTable.id })
          .from(macrosTable)
          .where(eq(macrosTable.createdBy, soleOwner));
        expect(macroRow).toBeUndefined();
        const strandedGrants = await testApp.database
          .select({ id: resourceGrants.id })
          .from(resourceGrants)
          .where(eq(resourceGrants.granteeId, soleOwner));
        expect(strandedGrants).toEqual([]);
      } finally {
        await creator.close();
      }
    });

    // Liveness gates *every* seed, not only the husk one. Here the organization
    // has a perfectly good living owner, so the seed branch that fires is the
    // shared-org member one — and it must still refuse a closed account.
    it("refuses a create by a closed account even when the organization still has an owner", async () => {
      const creator = createSecondaryDatabase();
      try {
        const creatorRepo = new MacroRepository(creator.database, testApp.module.get(CACHE_PORT));

        const org = await testApp.createOrganization();
        const livingOwner = await testApp.createTestUser({ email: "still-here@example.com" });
        await testApp.addOrganizationMember(org, livingOwner, "owner");
        const departing = await testApp.createTestUser({ email: "departing-member@example.com" });
        await testApp.addOrganizationMember(org, departing, "member");

        // They own nothing, so nothing blocks their deletion.
        assertSuccess(await repository.delete(departing));

        const creation = await creatorRepo.create(
          {
            name: `After death ${faker.string.uuid()}`,
            description: "d",
            language: "python",
            code: "eA==",
          },
          departing,
          org,
        );

        // A `member` needs a seeded grant to control what they create — but a grant
        // to a closed account is unreachable garbage: the deletion that closed it
        // swept their grants already and will never run again.
        assertFailure(creation);
        expect(creation.error.message).toContain("closed account");
        const stranded = await testApp.database
          .select({ id: resourceGrants.id })
          .from(resourceGrants)
          .where(eq(resourceGrants.granteeId, departing));
        expect(stranded).toEqual([]);
      } finally {
        await creator.close();
      }
    });

    // Deletion has to leave a marker even when there is nothing to stamp, or the
    // account stays indistinguishable from a living one forever.
    it("leaves a tombstone profile when deleting an account that never onboarded", async () => {
      const creator = createSecondaryDatabase();
      try {
        const creatorRepo = new MacroRepository(creator.database, testApp.module.get(CACHE_PORT));

        const preOnboarding = await testApp.createTestUser({
          email: "never-onboarded@example.com",
          createProfile: false,
        });
        const personalOrg = await testApp.personalOrganizationId(preOnboarding);

        assertSuccess(await repository.delete(preOnboarding));

        // The marker exists and is scrubbed...
        const [tombstone] = await testApp.database
          .select()
          .from(profiles)
          .where(eq(profiles.userId, preOnboarding));
        expect(tombstone).toBeDefined();
        expect(tombstone.deletedAt).not.toBeNull();
        expect(tombstone.firstName).toBe("Deleted");

        // ...so they stop counting as a living owner of their own workspace...
        const [{ living }] = await testApp.database.execute<{ living: number }>(
          sql`SELECT count(*)::int AS living FROM (
                ${livingOrgOwnerIdsSql(sql`${personalOrg}::uuid`)}
              ) o`,
        );
        expect(Number(living)).toBe(0);

        // ...and a create on their behalf is refused rather than staffed to them.
        const creation = await creatorRepo.create(
          {
            name: `Ghost ${faker.string.uuid()}`,
            description: "d",
            language: "python",
            code: "eA==",
          },
          preOnboarding,
          personalOrg,
        );
        assertFailure(creation);
        expect(creation.error.message).toContain("closed account");
      } finally {
        await creator.close();
      }
    });

    it("survives two of the last two admins deleting concurrently", async () => {
      // Across two connections so the deletions genuinely overlap and the row lock
      // is what serializes them.
      const secondary = createSecondaryDatabase();
      try {
        const secondaryRepo = new UserRepository(secondary.database);

        // A husk-org experiment: its owner is gone, so the two admin grants are the
        // only thing keeping it answerable — which is when the invariant bites and
        // the race is worth running.
        const gone = await testApp.createTestUser({ email: "race-owner-n2@example.com" });
        const { experiment } = await testApp.createExperiment({
          name: "Deletion Race N2",
          userId: gone,
        });
        const adminA = await testApp.createTestUser({ email: "race-a-n2@example.com" });
        const adminB = await testApp.createTestUser({ email: "race-b-n2@example.com" });
        for (const granteeId of [adminA, adminB]) {
          await testApp.addResourceGrant({
            resourceType: "experiment",
            resourceId: experiment.id,
            granteeType: "user",
            granteeId,
            role: "admin",
          });
        }
        assertSuccess(await repository.delete(gone));
        expect(await staffingGrantCount(experiment.id)).toBe(2);

        const outcomes = await Promise.all([
          secondaryRepo.delete(adminA),
          repository.delete(adminB),
        ]);

        // Exactly one deletion may win; the other must be refused so the experiment
        // keeps an admin.
        expect(outcomes.filter((r) => r.isSuccess())).toHaveLength(1);
        expect(await staffingGrantCount(experiment.id)).toBe(1);
      } finally {
        await secondary.close();
      }
    });

    /**
     * The per-resource lock order, asserted directly rather than through a deadlock:
     * two deletions racing on the same pair of resources only deadlock when their
     * plans return the pair in opposite orders, which is not something a test can
     * force out of Postgres — with `DISTINCT` on `(resource_type, resource_id)` the
     * two backends aggregate the same two keys and happen to agree. So this pins the
     * ordering itself: whatever order the grant rows were written in, the deletion
     * reaches the `macro` before the `workbook` (the fixed `resource_type, resource_id`
     * order), which is what makes the opposite-order cycle impossible.
     */
    it("takes its per-resource locks in a fixed order regardless of how the grants were written", async () => {
      const blocker = createSecondaryDatabase();
      const deleter = createSecondaryDatabase();
      try {
        const deleterRepo = new UserRepository(deleter.database);

        // Both resources stay owned by a living owner, so neither deletion is
        // refused — what is under test is the order the locks are taken in, not the
        // invariant.
        const keeper = await testApp.createTestUser({ email: "lock-order-keeper@example.com" });
        const macro = await createAuthoredResource("macro", keeper);
        const workbook = await createAuthoredResource("workbook", keeper);

        // Written in opposite orders on purpose: without an ORDER BY the two users'
        // rows come back in insertion order, so one would lock the macro first and the
        // other the workbook first.
        const macroFirst = await testApp.createTestUser({ email: "lock-order-macro@example.com" });
        const workbookFirst = await testApp.createTestUser({
          email: "lock-order-workbook@example.com",
        });
        for (const [granteeId, resourceType, resourceId] of [
          [macroFirst, "macro", macro.id],
          [macroFirst, "workbook", workbook.id],
          [workbookFirst, "workbook", workbook.id],
          [workbookFirst, "macro", macro.id],
        ] as const) {
          await testApp.addResourceGrant({
            resourceType,
            resourceId,
            granteeType: "user",
            granteeId,
            role: "admin",
          });
        }

        /** Whether the workbook's staffing rows are free right now. */
        const workbookIsUnlocked = async () => {
          try {
            await testApp.database.transaction(async (tx) => {
              await tx
                .select({ id: resourceGrants.id })
                .from(resourceGrants)
                .where(
                  and(
                    eq(resourceGrants.resourceType, "workbook"),
                    eq(resourceGrants.resourceId, workbook.id),
                  ),
                )
                .for("update", { noWait: true });
            });
            return true;
          } catch {
            // 55P03: somebody else holds them — here, only the deletion can.
            return false;
          }
        };

        const waitUntilBlocked = async () => {
          for (let attempt = 0; attempt < 100; attempt++) {
            const [{ waiting }] = await testApp.database.execute<{ waiting: number }>(
              sql`SELECT count(*)::int AS waiting FROM pg_stat_activity
                  WHERE datname = current_database() AND wait_event_type = 'Lock'`,
            );
            if (Number(waiting) > 0) return;
            await new Promise((resolve) => setTimeout(resolve, 50));
          }
          throw new Error("the deletion never blocked on the seeded macro lock");
        };

        for (const leaving of [macroFirst, workbookFirst]) {
          let release!: () => void;
          const released = new Promise<void>((resolve) => {
            release = resolve;
          });
          // Hold the macro — first in the fixed order — from another connection.
          const holding = blocker.database.transaction(async (tx) => {
            await lockStaffingGrants(tx, "macro", macro.id);
            await released;
          });

          const deletion = deleterRepo.delete(leaving);
          await waitUntilBlocked();

          // Blocked on the macro, so it cannot yet be holding the workbook — the
          // opposite order would have taken that lock first.
          expect(await workbookIsUnlocked()).toBe(true);

          release();
          await holding;
          assertSuccess(await deletion);
        }

        // Both deletions went through, so no admin grant is left on either — the
        // owning org's living owner is what still answers for them.
        expect(await staffingGrantCount(macro.id, "macro")).toBe(0);
        expect(await staffingGrantCount(workbook.id, "workbook")).toBe(0);
      } finally {
        await Promise.all([blocker.close(), deleter.close()]);
      }
    });
  });
});
