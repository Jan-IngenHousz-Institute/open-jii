import { faker } from "@faker-js/faker";
import * as crypto from "crypto";
import { StatusCodes } from "http-status-codes";

import type { UserMetadataWebhookPayload, WebhookErrorResponse } from "@repo/api";
import { contract } from "@repo/api";

import { failure, AppError } from "../../common/utils/fp-utils";
import { stableStringify } from "../../common/utils/stable-json";
import { TestHarness } from "../../test/test-harness";
import { GetUsersMetadataUseCase } from "../application/use-cases/get-users-metadata/get-users-metadata";
import { UserRepository } from "../core/repositories/user.repository";

describe("UserWebhookController", () => {
  const testApp = TestHarness.App;
  let userRepository: UserRepository;
  let getUsersMetadataUseCase: GetUsersMetadataUseCase;

  const apiKeyId = process.env.DATABRICKS_WEBHOOK_API_KEY_ID ?? "test-api-key-id";
  const webhookSecret = process.env.DATABRICKS_WEBHOOK_SECRET ?? "test-webhook-secret";

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    userRepository = testApp.module.get(UserRepository);
    getUsersMetadataUseCase = testApp.module.get(GetUsersMetadataUseCase);

    // Reset any mocks before each test
    vi.restoreAllMocks();
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("handleGetUserMetadata", () => {
    it("should return user metadata for valid user IDs", async () => {
      // Create test users with profiles
      const testUser1Id = await testApp.createTestUser({
        email: "user1@example.com",
        name: "John Doe",
      });
      const testUser2Id = await testApp.createTestUser({
        email: "user2@example.com",
        name: "Jane Smith",
      });

      // Create profiles for test users
      await userRepository.createOrUpdateUserProfile(testUser1Id, {
        firstName: "John",
        lastName: "Doe",
        bio: "Test bio 1",
        activated: true,
      });
      await userRepository.createOrUpdateUserProfile(testUser2Id, {
        firstName: "Jane",
        lastName: "Smith",
        bio: "Test bio 2",
        activated: true,
      });

      // Define webhook payload
      const webhookPayload: UserMetadataWebhookPayload = {
        userIds: [testUser1Id, testUser2Id],
      };

      // Get current timestamp
      const timestamp = Math.floor(Date.now() / 1000).toString();

      // Create signature
      const payload = `${timestamp}:${stableStringify(webhookPayload)}`;
      const signature = crypto.createHmac("sha256", webhookSecret).update(payload).digest("hex");

      // Make the API request with the required headers
      const response = await testApp
        .post(contract.users.getUserMetadata.path)
        .set("x-api-key-id", apiKeyId)
        .set("x-databricks-signature", signature)
        .set("x-databricks-timestamp", timestamp)
        .send(webhookPayload);

      // Verify response
      expect(response.status).toBe(StatusCodes.OK);
      expect(response.body).toEqual({
        users: [
          {
            userId: testUser1Id,
            firstName: "John",
            lastName: "Doe",
            avatarUrl: null,
          },
          {
            userId: testUser2Id,
            firstName: "Jane",
            lastName: "Smith",
            avatarUrl: null,
          },
        ],
        success: true,
      });
    });

    it("should return empty users array for empty user IDs array", async () => {
      // Define webhook payload with empty user IDs
      const webhookPayload: UserMetadataWebhookPayload = {
        userIds: [],
      };

      // Get current timestamp and create signature
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const payload = `${timestamp}:${stableStringify(webhookPayload)}`;
      const signature = crypto.createHmac("sha256", webhookSecret).update(payload).digest("hex");

      // Act & Assert - should return bad request due to validation (min 1 user)
      await testApp
        .post(contract.users.getUserMetadata.path)
        .set("x-api-key-id", apiKeyId)
        .set("x-databricks-signature", signature)
        .set("x-databricks-timestamp", timestamp)
        .send(webhookPayload)
        .expect(StatusCodes.BAD_REQUEST);
    });

    it("should return partial results for mix of valid and invalid user IDs", async () => {
      // Create test user with profile
      const testUserId = await testApp.createTestUser({
        email: "validuser@example.com",
        name: "Valid User",
      });

      await userRepository.createOrUpdateUserProfile(testUserId, {
        firstName: "Valid",
        lastName: "User",
        activated: true,
      });

      const invalidUserId = faker.string.uuid();

      // Define webhook payload
      const webhookPayload: UserMetadataWebhookPayload = {
        userIds: [testUserId, invalidUserId],
      };

      // Get current timestamp and create signature
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const payload = `${timestamp}:${stableStringify(webhookPayload)}`;
      const signature = crypto.createHmac("sha256", webhookSecret).update(payload).digest("hex");

      // Make the API request
      const response = await testApp
        .post(contract.users.getUserMetadata.path)
        .set("x-api-key-id", apiKeyId)
        .set("x-databricks-signature", signature)
        .set("x-databricks-timestamp", timestamp)
        .send(webhookPayload);

      // Verify response - should only return valid user
      expect(response.status).toBe(StatusCodes.OK);
      expect(response.body).toEqual({
        users: [
          {
            userId: testUserId,
            firstName: "Valid",
            lastName: "User",
            avatarUrl: null,
          },
        ],
        success: true,
      });
    });

    it("should exclude users without profiles (inner join)", async () => {
      // Create test user without profile
      const testUserIdWithoutProfile = await testApp.createTestUser({
        email: "noprofile@example.com",
        name: "No Profile User",
        createProfile: false, // Don't create profile for this user
      });

      // Define webhook payload
      const webhookPayload: UserMetadataWebhookPayload = {
        userIds: [testUserIdWithoutProfile],
      };

      // Get current timestamp and create signature
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const payload = `${timestamp}:${stableStringify(webhookPayload)}`;
      const signature = crypto.createHmac("sha256", webhookSecret).update(payload).digest("hex");

      // Make the API request
      const response = await testApp
        .post(contract.users.getUserMetadata.path)
        .set("x-api-key-id", apiKeyId)
        .set("x-databricks-signature", signature)
        .set("x-databricks-timestamp", timestamp)
        .send(webhookPayload);

      // Verify response - should return empty users array due to inner join
      expect(response.status).toBe(StatusCodes.OK);
      expect(response.body).toEqual({
        users: [],
        success: true,
      });
    });

    it("should handle mix of users with and without profiles", async () => {
      // Create user with profile
      const userWithProfileId = await testApp.createTestUser({
        email: "withprofile@example.com",
        name: "With Profile User",
      });

      await userRepository.createOrUpdateUserProfile(userWithProfileId, {
        firstName: "With",
        lastName: "Profile",
        activated: true,
      });

      // Create user without profile
      const userWithoutProfileId = await testApp.createTestUser({
        email: "noprofile@example.com",
        name: "No Profile User",
        createProfile: false,
      });

      // Define webhook payload
      const webhookPayload: UserMetadataWebhookPayload = {
        userIds: [userWithProfileId, userWithoutProfileId],
      };

      // Get current timestamp and create signature
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const payload = `${timestamp}:${stableStringify(webhookPayload)}`;
      const signature = crypto.createHmac("sha256", webhookSecret).update(payload).digest("hex");

      // Make the API request
      const response = await testApp
        .post(contract.users.getUserMetadata.path)
        .set("x-api-key-id", apiKeyId)
        .set("x-databricks-signature", signature)
        .set("x-databricks-timestamp", timestamp)
        .send(webhookPayload);

      // Verify response - should only return user with profile
      expect(response.status).toBe(StatusCodes.OK);
      expect(response.body).toEqual({
        users: [
          {
            userId: userWithProfileId,
            firstName: "With",
            lastName: "Profile",
            avatarUrl: null,
          },
        ],
        success: true,
      });
    });

    it("should reject requests without valid API key ID", async () => {
      // Define webhook payload
      const webhookPayload: UserMetadataWebhookPayload = {
        userIds: [faker.string.uuid()],
      };

      // Make the API request without required headers
      await testApp
        .post(contract.users.getUserMetadata.path)
        .send(webhookPayload)
        .expect(StatusCodes.UNAUTHORIZED)
        .expect(({ body }: { body: WebhookErrorResponse }) => {
          expect(body.message).toContain("Unauthorized");
        });
    });

    it("should reject requests with invalid signature", async () => {
      // Define webhook payload
      const webhookPayload: UserMetadataWebhookPayload = {
        userIds: [faker.string.uuid()],
      };

      // Get current timestamp
      const timestamp = Math.floor(Date.now() / 1000).toString();

      // Create invalid signature
      const invalidSignature = "invalid_signature";

      // Make the API request with invalid signature
      await testApp
        .post(contract.users.getUserMetadata.path)
        .set("x-api-key-id", apiKeyId)
        .set("x-databricks-signature", invalidSignature)
        .set("x-databricks-timestamp", timestamp)
        .send(webhookPayload)
        .expect(StatusCodes.UNAUTHORIZED)
        .expect(({ body }: { body: WebhookErrorResponse }) => {
          expect(body.message).toContain("Unauthorized");
        });
    });

    it("should reject requests with malformed user IDs", async () => {
      // Define webhook payload with invalid UUID
      const webhookPayload = {
        userIds: ["not-a-valid-uuid"],
      };

      // Get current timestamp and create signature
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const payload = `${timestamp}:${stableStringify(webhookPayload)}`;
      const signature = crypto.createHmac("sha256", webhookSecret).update(payload).digest("hex");

      // Make the API request
      await testApp
        .post(contract.users.getUserMetadata.path)
        .set("x-api-key-id", apiKeyId)
        .set("x-databricks-signature", signature)
        .set("x-databricks-timestamp", timestamp)
        .send(webhookPayload)
        .expect(StatusCodes.BAD_REQUEST);
    });

    it("should reject requests with too many user IDs", async () => {
      // Define webhook payload with more than 100 user IDs (max limit)
      const tooManyUserIds = Array.from({ length: 101 }, () => faker.string.uuid());
      const webhookPayload: UserMetadataWebhookPayload = {
        userIds: tooManyUserIds,
      };

      // Get current timestamp and create signature
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const payload = `${timestamp}:${stableStringify(webhookPayload)}`;
      const signature = crypto.createHmac("sha256", webhookSecret).update(payload).digest("hex");

      // Make the API request
      await testApp
        .post(contract.users.getUserMetadata.path)
        .set("x-api-key-id", apiKeyId)
        .set("x-databricks-signature", signature)
        .set("x-databricks-timestamp", timestamp)
        .send(webhookPayload)
        .expect(StatusCodes.BAD_REQUEST);
    });

    it("should return 500 when use case returns failure", async () => {
      vi.spyOn(getUsersMetadataUseCase, "execute").mockResolvedValue(
        failure(AppError.internal("Database connection lost")),
      );

      const webhookPayload: UserMetadataWebhookPayload = {
        userIds: [faker.string.uuid()],
      };

      const timestamp = Math.floor(Date.now() / 1000).toString();
      const payload = `${timestamp}:${stableStringify(webhookPayload)}`;
      const signature = crypto.createHmac("sha256", webhookSecret).update(payload).digest("hex");

      await testApp
        .post(contract.users.getUserMetadata.path)
        .set("x-api-key-id", apiKeyId)
        .set("x-databricks-signature", signature)
        .set("x-databricks-timestamp", timestamp)
        .send(webhookPayload)
        .expect(StatusCodes.INTERNAL_SERVER_ERROR);
    });

    it("should handle duplicate user IDs gracefully", async () => {
      // Create test user with profile
      const testUserId = await testApp.createTestUser({
        email: "duplicatetest@example.com",
        name: "Duplicate Test User",
      });

      await userRepository.createOrUpdateUserProfile(testUserId, {
        firstName: "Duplicate",
        lastName: "Test",
        activated: true,
      });

      // Define webhook payload with duplicate user IDs
      const webhookPayload: UserMetadataWebhookPayload = {
        userIds: [testUserId, testUserId, testUserId],
      };

      // Get current timestamp and create signature
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const payload = `${timestamp}:${stableStringify(webhookPayload)}`;
      const signature = crypto.createHmac("sha256", webhookSecret).update(payload).digest("hex");

      // Make the API request
      const response = await testApp
        .post(contract.users.getUserMetadata.path)
        .set("x-api-key-id", apiKeyId)
        .set("x-databricks-signature", signature)
        .set("x-databricks-timestamp", timestamp)
        .send(webhookPayload);

      // Verify response - should return user only once despite duplicates
      expect(response.status).toBe(StatusCodes.OK);
      expect(response.body).toEqual({
        users: [
          {
            userId: testUserId,
            firstName: "Duplicate",
            lastName: "Test",
            avatarUrl: null,
          },
        ],
        success: true,
      });
    });
  });
});
