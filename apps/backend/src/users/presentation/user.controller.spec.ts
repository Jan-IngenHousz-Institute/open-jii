import { faker } from "@faker-js/faker";
import { StatusCodes } from "http-status-codes";

import type { ErrorResponse, UserList, User } from "@repo/api";
import { contract } from "@repo/api";

import type { SuperTestResponse } from "../../test/test-harness";
import { TestHarness } from "../../test/test-harness";

describe("UserController", () => {
  const testApp = TestHarness.App;
  let testUserId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});

    // Reset any mocks before each test
    jest.restoreAllMocks();
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("searchUsers", () => {
    it("should return an empty array if no users match the search", async () => {
      const response: SuperTestResponse<UserList> = await testApp
        .get(contract.users.searchUsers.path)
        .withAuth(testUserId)
        .query({ query: "nonexistentuser" })
        .expect(StatusCodes.OK);

      expect(response.body).toEqual([]);
    });

    it("should return a list of users without query parameters", async () => {
      // Create some test users
      const user1Id = await testApp.createTestUser({
        name: "Alice Smith",
        email: "alice@example.com",
      });
      const user2Id = await testApp.createTestUser({
        name: "Bob Johnson",
        email: "bob@example.com",
      });

      const response: SuperTestResponse<UserList> = await testApp
        .get(contract.users.searchUsers.path)
        .withAuth(testUserId)
        .expect(StatusCodes.OK);

      expect(response.body.length).toBeGreaterThanOrEqual(3); // At least the 3 users we created

      const userIds = response.body.map((u) => u.id);
      expect(userIds).toContain(testUserId);
      expect(userIds).toContain(user1Id);
      expect(userIds).toContain(user2Id);
    });

    it("should search users by name", async () => {
      // Create users with specific names
      await testApp.createTestUser({
        name: "Alice Smith",
        email: "alice@example.com",
      });
      await testApp.createTestUser({
        name: "Bob Johnson",
        email: "bob@example.com",
      });

      const response: SuperTestResponse<UserList> = await testApp
        .get(contract.users.searchUsers.path)
        .withAuth(testUserId)
        .query({ query: "Alice" })
        .expect(StatusCodes.OK);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].name).toBe("Alice Smith");
    });

    it("should search users by email", async () => {
      // Create users with specific emails
      await testApp.createTestUser({
        name: "Alice Smith",
        email: "alice@example.com",
      });
      await testApp.createTestUser({
        name: "Bob Johnson",
        email: "bob@example.com",
      });

      const response: SuperTestResponse<UserList> = await testApp
        .get(contract.users.searchUsers.path)
        .withAuth(testUserId)
        .query({ query: "alice@example.com" })
        .expect(StatusCodes.OK);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].email).toBe("alice@example.com");
    });

    it("should search users with partial name match", async () => {
      // Create users with similar names
      await testApp.createTestUser({
        name: "Alice Smith",
        email: "alice@example.com",
      });
      await testApp.createTestUser({
        name: "Alice Johnson",
        email: "alice.johnson@example.com",
      });

      const response: SuperTestResponse<UserList> = await testApp
        .get(contract.users.searchUsers.path)
        .withAuth(testUserId)
        .query({ query: "Alice" })
        .expect(StatusCodes.OK);

      expect(response.body).toHaveLength(2);
      expect(
        response.body.every((u) => u.name?.includes("Alice") ?? false),
      ).toBe(true);
    });

    it("should apply limit and offset for pagination", async () => {
      // Create multiple users
      const userIds: string[] = [];
      for (let i = 0; i < 5; i++) {
        const userId = await testApp.createTestUser({
          name: `User ${i}`,
          email: `user${i}@example.com`,
        });
        userIds.push(userId);
      }

      // Get first 2 users
      const firstPageResponse: SuperTestResponse<UserList> = await testApp
        .get(contract.users.searchUsers.path)
        .withAuth(testUserId)
        .query({ limit: 2, offset: 0 })
        .expect(StatusCodes.OK);

      expect(firstPageResponse.body).toHaveLength(2);

      // Get next 2 users
      const secondPageResponse: SuperTestResponse<UserList> = await testApp
        .get(contract.users.searchUsers.path)
        .withAuth(testUserId)
        .query({ limit: 2, offset: 2 })
        .expect(StatusCodes.OK);

      expect(secondPageResponse.body).toHaveLength(2);

      // Ensure no overlap between pages
      const firstPageIds = firstPageResponse.body.map((u) => u.id);
      const secondPageIds = secondPageResponse.body.map((u) => u.id);
      expect(firstPageIds.some((id) => secondPageIds.includes(id))).toBe(false);
    });

    it("should return 401 if not authenticated", async () => {
      await testApp
        .get(contract.users.searchUsers.path)
        .withoutAuth()
        .expect(StatusCodes.UNAUTHORIZED);
    });
  });

  describe("getUser", () => {
    it("should return a user by ID", async () => {
      const userEmail = faker.internet.email();
      const userId = await testApp.createTestUser({ email: userEmail });

      const path = testApp.resolvePath(contract.users.getUser.path, {
        id: userId,
      });

      const response: SuperTestResponse<User> = await testApp
        .get(path)
        .withAuth(testUserId)
        .expect(StatusCodes.OK);

      expect(response.body).toMatchObject({
        id: userId,
        email: userEmail,
      });
    });

    it("should return 404 if user does not exist", async () => {
      const nonExistentId = faker.string.uuid();
      const path = testApp.resolvePath(contract.users.getUser.path, {
        id: nonExistentId,
      });

      await testApp
        .get(path)
        .withAuth(testUserId)
        .expect(StatusCodes.NOT_FOUND)
        .expect(({ body }: { body: ErrorResponse }) => {
          expect(body.message).toContain("not found");
        });
    });

    it("should return 400 for invalid UUID", async () => {
      const invalidId = "invalid-uuid";
      const path = testApp.resolvePath(contract.users.getUser.path, {
        id: invalidId,
      });

      await testApp
        .get(path)
        .withAuth(testUserId)
        .expect(StatusCodes.BAD_REQUEST);
    });

    it("should return 401 if not authenticated", async () => {
      const path = testApp.resolvePath(contract.users.getUser.path, {
        id: testUserId,
      });

      await testApp.get(path).withoutAuth().expect(StatusCodes.UNAUTHORIZED);
    });

    it("should allow user to get their own profile", async () => {
      const userEmail = faker.internet.email();
      const userId = await testApp.createTestUser({ email: userEmail });

      const path = testApp.resolvePath(contract.users.getUser.path, {
        id: userId,
      });

      const response: SuperTestResponse<User> = await testApp
        .get(path)
        .withAuth(testUserId)
        .expect(StatusCodes.OK);

      expect(response.body).toMatchObject({
        id: userId,
        email: userEmail,
      });
    });

    it("should allow user to get other users' profiles", async () => {
      // Create another user
      const otherUserId = await testApp.createTestUser({
        name: "Other User",
        email: "other@example.com",
      });

      const path = testApp.resolvePath(contract.users.getUser.path, {
        id: otherUserId,
      });

      const response: SuperTestResponse<User> = await testApp
        .get(path)
        .withAuth(testUserId)
        .expect(StatusCodes.OK);

      expect(response.body).toMatchObject({
        id: otherUserId,
        email: "other@example.com",
        name: "Other User",
      });
    });
  });
});
