import { faker } from "@faker-js/faker";

import { users, organizations, profiles, eq } from "@repo/database";

import { assertSuccess } from "../../../common/utils/fp-utils";
import { TestHarness } from "../../../test/test-harness";
import { UserRepository } from "./user.repository";

describe("UserRepository", () => {
  const testApp = TestHarness.App;
  let repository: UserRepository;
  let testUserId: string;

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
        emailVerified: new Date(),
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

      const userIds = foundUsers.map((u) => u.id);
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
      expect(foundUsers[0].name).toBe("Alice Smith");
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
      expect(foundUsers.every((u) => u.name?.includes("Alice"))).toBe(true);
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
      const firstPageIds = firstPageUsers.map((u) => u.id);
      const secondPageIds = secondPageUsers.map((u) => u.id);
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

  describe("delete", () => {
    it("should delete a user", async () => {
      // Arrange
      const userToDeleteId = await testApp.createTestUser({
        name: "User to Delete",
        email: "delete@example.com",
      });

      // Act
      const result = await repository.delete(userToDeleteId);

      // Assert
      expect(result.isSuccess()).toBe(true);

      // Verify user is deleted
      const dbResult = await testApp.database
        .select()
        .from(users)
        .where(eq(users.id, userToDeleteId));

      expect(dbResult.length).toBe(0);
    });
  });

  describe("createOrUpdateUserProfile", () => {
    it("should create a new user profile with a new organization", async () => {
      const dto = {
        firstName: "Alice",
        lastName: "Smith",
        organization: "NewOrg",
      };

      const result = await repository.createOrUpdateUserProfile(testUserId, dto);

      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toMatchObject({
        firstName: dto.firstName,
        lastName: dto.lastName,
        organization: dto.organization,
      });

      // Check organization was created
      const orgs = await testApp.database
        .select()
        .from(organizations)
        .where(eq(organizations.name, dto.organization));
      expect(orgs.length).toBe(1);

      // Check profile was created
      const profs = await testApp.database
        .select()
        .from(profiles)
        .where(eq(profiles.userId, testUserId));
      expect(profs.length).toBe(1);
      expect(profs[0].firstName).toBe(dto.firstName);
    });

    it("should update an existing user profile", async () => {
      // First, create a profile
      const initialDto = {
        firstName: "Bob",
        lastName: "Jones",
        organization: "Org1",
      };
      await repository.createOrUpdateUserProfile(testUserId, initialDto);

      // Now, update the profile
      const updateDto = {
        firstName: "Robert",
        lastName: "Jones",
        organization: "Org1",
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

    it("should create a user profile without an organization", async () => {
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
        organization: undefined,
      });

      // Check profile was created
      const profs = await testApp.database
        .select()
        .from(profiles)
        .where(eq(profiles.userId, testUserId));
      expect(profs.length).toBe(1);
      expect(profs[0].firstName).toBe(dto.firstName);
    });

    it("should use existing organization if it already exists", async () => {
      // Pre-create organization
      const orgName = "ExistingOrg";
      await testApp.database.insert(organizations).values({ name: orgName }).returning();

      const dto = {
        firstName: "Dana",
        lastName: "White",
        organization: orgName,
      };

      const result = await repository.createOrUpdateUserProfile(testUserId, dto);

      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value.organization).toBe(orgName);

      // Should not create a duplicate organization
      const orgs = await testApp.database
        .select()
        .from(organizations)
        .where(eq(organizations.name, orgName));
      expect(orgs.length).toBe(1);
    });
  });
});
