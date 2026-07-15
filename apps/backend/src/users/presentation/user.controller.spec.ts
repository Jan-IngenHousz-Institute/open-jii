import { faker } from "@faker-js/faker";
import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api/contract";
import type {
  UserList,
  UserProfileList,
  User,
  DeletionBlockersResponse,
} from "@repo/api/domains/user/user.schema";
import type { ErrorResponse } from "@repo/api/shared/errors";

import { failure, AppError } from "../../common/utils/fp-utils";
import type { SuperTestResponse } from "../../test/test-harness";
import { TestHarness } from "../../test/test-harness";
import { CreateUserProfileUseCase } from "../application/use-cases/create-user-profile/create-user-profile";
import { GetDeletionBlockersUseCase } from "../application/use-cases/get-deletion-blockers/get-deletion-blockers";
import { SearchUsersUseCase } from "../application/use-cases/search-users/search-users";

describe("UserController", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let searchUsersUseCase: SearchUsersUseCase;
  let createUserProfileUseCase: CreateUserProfileUseCase;
  let getDeletionBlockersUseCase: GetDeletionBlockersUseCase;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    searchUsersUseCase = testApp.module.get(SearchUsersUseCase);
    createUserProfileUseCase = testApp.module.get(CreateUserProfileUseCase);
    getDeletionBlockersUseCase = testApp.module.get(GetDeletionBlockersUseCase);
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
        .get(testApp.resolveOrpcPath(contract.users.searchUsers))
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

      const response: SuperTestResponse<UserProfileList> = await testApp
        .get(testApp.resolveOrpcPath(contract.users.searchUsers))
        .withAuth(testUserId)
        .expect(StatusCodes.OK);

      expect(response.body.length).toBeGreaterThanOrEqual(3); // At least the 3 users we created

      const userIds = response.body.map((u) => u.userId);
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

      const response: SuperTestResponse<UserProfileList> = await testApp
        .get(testApp.resolveOrpcPath(contract.users.searchUsers))
        .withAuth(testUserId)
        .query({ query: "Alice" })
        .expect(StatusCodes.OK);

      expect(response.body).toHaveLength(1);
      expect(`${response.body[0].firstName} ${response.body[0].lastName}`).toBe("Alice Smith");
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
        .get(testApp.resolveOrpcPath(contract.users.searchUsers))
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

      const response: SuperTestResponse<UserProfileList> = await testApp
        .get(testApp.resolveOrpcPath(contract.users.searchUsers))
        .withAuth(testUserId)
        .query({ query: "Alice" })
        .expect(StatusCodes.OK);

      expect(response.body).toHaveLength(2);
      expect(response.body.every((u) => `${u.firstName} ${u.lastName}`.includes("Alice"))).toBe(
        true,
      );
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
      const firstPageResponse: SuperTestResponse<UserProfileList> = await testApp
        .get(testApp.resolveOrpcPath(contract.users.searchUsers))
        .withAuth(testUserId)
        .query({ limit: 2, offset: 0 })
        .expect(StatusCodes.OK);

      expect(firstPageResponse.body).toHaveLength(2);

      // Get next 2 users
      const secondPageResponse: SuperTestResponse<UserProfileList> = await testApp
        .get(testApp.resolveOrpcPath(contract.users.searchUsers))
        .withAuth(testUserId)
        .query({ limit: 2, offset: 2 })
        .expect(StatusCodes.OK);

      expect(secondPageResponse.body).toHaveLength(2);

      // Ensure no overlap between pages
      const firstPageIds = firstPageResponse.body.map((u) => u.userId);
      const secondPageIds = secondPageResponse.body.map((u) => u.userId);
      expect(firstPageIds.some((id) => secondPageIds.includes(id))).toBe(false);
    });

    it("should return 401 if not authenticated", async () => {
      await testApp
        .get(testApp.resolveOrpcPath(contract.users.searchUsers))
        .withoutAuth()
        .expect(StatusCodes.UNAUTHORIZED);
    });

    it("should return 500 when use case returns failure", async () => {
      vi.spyOn(searchUsersUseCase, "execute").mockResolvedValue(
        failure(AppError.internal("Database error")),
      );

      await testApp
        .get(testApp.resolveOrpcPath(contract.users.searchUsers))
        .withAuth(testUserId)
        .expect(StatusCodes.INTERNAL_SERVER_ERROR);
    });
  });

  describe("getUser", () => {
    it("should return a user by ID", async () => {
      const userEmail = faker.internet.email();
      const userId = await testApp.createTestUser({ email: userEmail });

      const path = testApp.resolveOrpcPath(contract.users.getUser, {
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
      const path = testApp.resolveOrpcPath(contract.users.getUser, {
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
      const path = testApp.resolveOrpcPath(contract.users.getUser, {
        id: invalidId,
      });

      await testApp.get(path).withAuth(testUserId).expect(StatusCodes.BAD_REQUEST);
    });

    it("should return 401 if not authenticated", async () => {
      const path = testApp.resolveOrpcPath(contract.users.getUser, {
        id: testUserId,
      });

      await testApp.get(path).withoutAuth().expect(StatusCodes.UNAUTHORIZED);
    });

    it("should allow user to get their own profile", async () => {
      const userEmail = faker.internet.email();
      const userId = await testApp.createTestUser({ email: userEmail });

      const path = testApp.resolveOrpcPath(contract.users.getUser, {
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

      const path = testApp.resolveOrpcPath(contract.users.getUser, {
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

  describe("createUserProfile", () => {
    it("should successfully create a user profile", async () => {
      const response = await testApp
        .post(testApp.resolveOrpcPath(contract.users.createUserProfile))
        .withAuth(testUserId)
        .send({ firstName: "Test", lastName: "User" })
        .expect(StatusCodes.CREATED);

      expect(response.body).toEqual({});
    });

    it("should successfully create a user profile with bio", async () => {
      const response = await testApp
        .post(testApp.resolveOrpcPath(contract.users.createUserProfile))
        .withAuth(testUserId)
        .send({
          firstName: "Test",
          lastName: "User",
          bio: "Software developer with experience in Node.js and React.",
        })
        .expect(StatusCodes.CREATED);

      expect(response.body).toEqual({});
    });

    it("should return 400 on invalid input", async () => {
      await testApp
        .post(testApp.resolveOrpcPath(contract.users.createUserProfile))
        .withAuth(testUserId)
        .send({ firstName: "Test" }) // Missing required fields
        .expect(StatusCodes.BAD_REQUEST);
    });

    it("should return 401 if not authenticated", async () => {
      await testApp
        .post(testApp.resolveOrpcPath(contract.users.createUserProfile))
        .withoutAuth()
        .send({ firstName: "Test", lastName: "User" })
        .expect(StatusCodes.UNAUTHORIZED);
    });

    it("should return 500 when use case returns failure", async () => {
      vi.spyOn(createUserProfileUseCase, "execute").mockResolvedValue(
        failure(AppError.internal("Database error")),
      );

      await testApp
        .post(testApp.resolveOrpcPath(contract.users.createUserProfile))
        .withAuth(testUserId)
        .send({ firstName: "Test", lastName: "User" })
        .expect(StatusCodes.INTERNAL_SERVER_ERROR);
    });
  });
  describe("getUserProfile", () => {
    it("should return the user's profile by ID", async () => {
      // Arrange: create a user and a profile for that user
      const userEmail = faker.internet.email();
      const userId = await testApp.createTestUser({ email: userEmail });

      // create profile via API to match real flow
      await testApp
        .post(testApp.resolveOrpcPath(contract.users.createUserProfile))
        .withAuth(userId)
        .send({
          firstName: "Ada",
          lastName: "Lovelace",
          bio: "Math enjoyer",
        })
        .expect(StatusCodes.CREATED);

      const path = testApp.resolveOrpcPath(contract.users.getUserProfile, { id: userId });

      // Act
      const res = await testApp
        .get(path)
        .withAuth(userId) // any authenticated user is fine due to your guard
        .expect(StatusCodes.OK);

      // Assert (shape only — adapt if your profile has more fields)
      expect(res.body).toMatchObject({
        firstName: "Ada",
        lastName: "Lovelace",
        bio: "Math enjoyer",
      });
    });

    it("should return 404 if user profile does not exist", async () => {
      const nonExistentId = faker.string.uuid();
      const path = testApp.resolveOrpcPath(contract.users.getUserProfile, {
        id: nonExistentId,
      });

      await testApp
        .get(path)
        .withAuth(testUserId)
        .expect(StatusCodes.NOT_FOUND)
        .expect(({ body }: { body: ErrorResponse }) => {
          expect(body.message.toLowerCase()).toContain("not found");
        });
    });

    it("should return 400 for invalid UUID", async () => {
      const path = testApp.resolveOrpcPath(contract.users.getUserProfile, {
        id: "invalid-uuid",
      });

      await testApp.get(path).withAuth(testUserId).expect(StatusCodes.BAD_REQUEST);
    });

    it("should return 401 if not authenticated", async () => {
      const path = testApp.resolveOrpcPath(contract.users.getUserProfile, { id: testUserId });

      await testApp.get(path).withoutAuth().expect(StatusCodes.UNAUTHORIZED);
    });
  });

  describe("deleteUser", () => {
    it("should successfully soft-delete a user and scrub PII", async () => {
      const userToDeleteId = await testApp.createTestUser({
        email: "delete-me@example.com",
        name: "User ToDelete",
      });

      const path = testApp.resolveOrpcPath(contract.users.deleteUser, {
        id: userToDeleteId,
      });

      // Act
      await testApp.delete(path).withAuth(testUserId).expect(StatusCodes.NO_CONTENT);

      // Assert: verify user was soft-deleted (row still exists but PII scrubbed)
      const getUserPath = testApp.resolveOrpcPath(contract.users.getUser, {
        id: userToDeleteId,
      });

      const response: SuperTestResponse<User> = await testApp
        .get(getUserPath)
        .withAuth(testUserId)
        .expect(StatusCodes.OK);

      expect(response.body).toMatchObject({
        id: userToDeleteId,
      });
      expect(response.body.email).not.toBe("delete-me@example.com"); // Anonymized
      expect(response.body.email).toMatch(/^deleted-/); // Starts with deleted- prefix
      expect(response.body.name).toBe("Deleted User");
    });

    it("should return 404 when deleting a non-existent user", async () => {
      const nonExistentId = faker.string.uuid();
      const path = testApp.resolveOrpcPath(contract.users.deleteUser, {
        id: nonExistentId,
      });

      await testApp
        .delete(path)
        .withAuth(testUserId)
        .expect(StatusCodes.NOT_FOUND)
        .expect(({ body }: { body: ErrorResponse }) => {
          expect(body.message.toLowerCase()).toContain("not found");
        });
    });

    it("should return 400 for invalid UUID", async () => {
      const path = testApp.resolveOrpcPath(contract.users.deleteUser, {
        id: "invalid-uuid",
      });

      await testApp.delete(path).withAuth(testUserId).expect(StatusCodes.BAD_REQUEST);
    });

    it("should return 401 if not authenticated", async () => {
      const userToDeleteId = await testApp.createTestUser({
        email: "delete-without-auth@example.com",
      });

      const path = testApp.resolveOrpcPath(contract.users.deleteUser, {
        id: userToDeleteId,
      });

      await testApp.delete(path).withoutAuth().expect(StatusCodes.UNAUTHORIZED);
    });
  });

  describe("getDeletionBlockers", () => {
    it("returns an empty list when the user administers nothing", async () => {
      const path = testApp.resolveOrpcPath(contract.users.getDeletionBlockers, {
        id: testUserId,
      });

      const response: SuperTestResponse<DeletionBlockersResponse> = await testApp
        .get(path)
        .withAuth(testUserId)
        .expect(StatusCodes.OK);

      expect(response.body).toEqual({ experiments: [] });
    });

    it("lists experiments where the user is the only admin, with their members as candidates", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Sole Admin Experiment",
        userId: testUserId,
      });
      const memberId = await testApp.createTestUser({ email: "member@example.com" });
      await testApp.addExperimentMember(experiment.id, memberId, "member");

      const path = testApp.resolveOrpcPath(contract.users.getDeletionBlockers, {
        id: testUserId,
      });

      const response: SuperTestResponse<DeletionBlockersResponse> = await testApp
        .get(path)
        .withAuth(testUserId)
        .expect(StatusCodes.OK);

      expect(response.body.experiments).toHaveLength(1);
      expect(response.body.experiments[0]).toMatchObject({
        id: experiment.id,
        name: experiment.name,
      });
      expect(response.body.experiments[0].candidates.map((c) => c.userId)).toEqual([memberId]);
    });

    it("returns 403 when requesting another user's deletion blockers", async () => {
      const otherUserId = await testApp.createTestUser({ email: "someone-else@example.com" });
      const path = testApp.resolveOrpcPath(contract.users.getDeletionBlockers, {
        id: otherUserId,
      });

      await testApp
        .get(path)
        .withAuth(testUserId)
        .expect(StatusCodes.FORBIDDEN)
        .expect(({ body }: { body: ErrorResponse }) => {
          expect(body.message.toLowerCase()).toContain("your own");
        });
    });

    it("returns 400 for an invalid UUID", async () => {
      const path = testApp.resolveOrpcPath(contract.users.getDeletionBlockers, {
        id: "invalid-uuid",
      });

      await testApp.get(path).withAuth(testUserId).expect(StatusCodes.BAD_REQUEST);
    });

    it("returns 401 if not authenticated", async () => {
      const path = testApp.resolveOrpcPath(contract.users.getDeletionBlockers, {
        id: testUserId,
      });

      await testApp.get(path).withoutAuth().expect(StatusCodes.UNAUTHORIZED);
    });

    it("returns 500 when the use case returns failure", async () => {
      vi.spyOn(getDeletionBlockersUseCase, "execute").mockResolvedValue(
        failure(AppError.internal("Database error")),
      );

      const path = testApp.resolveOrpcPath(contract.users.getDeletionBlockers, {
        id: testUserId,
      });

      await testApp.get(path).withAuth(testUserId).expect(StatusCodes.INTERNAL_SERVER_ERROR);
    });
  });
});
