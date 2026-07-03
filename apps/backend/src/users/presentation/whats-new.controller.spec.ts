import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api/contract";
import type { WhatsNewSeenResponse } from "@repo/api/schemas/user.schema";
import { profiles, eq } from "@repo/database";

import { failure, AppError } from "../../common/utils/fp-utils";
import type { SuperTestResponse } from "../../test/test-harness";
import { TestHarness } from "../../test/test-harness";
import { GetWhatsNewSeenUseCase } from "../application/use-cases/get-whats-new-seen/get-whats-new-seen";
import { MarkWhatsNewSeenUseCase } from "../application/use-cases/mark-whats-new-seen/mark-whats-new-seen";

describe("WhatsNewController", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let getWhatsNewSeenUseCase: GetWhatsNewSeenUseCase;
  let markWhatsNewSeenUseCase: MarkWhatsNewSeenUseCase;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    getWhatsNewSeenUseCase = testApp.module.get(GetWhatsNewSeenUseCase);
    markWhatsNewSeenUseCase = testApp.module.get(MarkWhatsNewSeenUseCase);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("getWhatsNewSeen", () => {
    it("should return null when the user has never opened the What's new panel", async () => {
      const response: SuperTestResponse<WhatsNewSeenResponse> = await testApp
        .get(contract.users.getWhatsNewSeen.path)
        .withAuth(testUserId)
        .expect(StatusCodes.OK);

      expect(response.body).toEqual({ lastSeenAt: null });
    });

    it("should return the last-seen timestamp as an ISO string when set", async () => {
      // Arrange: stamp a last-seen timestamp directly in the database
      const lastSeenAt = new Date("2026-01-15T10:30:00.000Z");
      await testApp.database
        .update(profiles)
        .set({ whatsNewLastSeenAt: lastSeenAt })
        .where(eq(profiles.userId, testUserId));

      const response: SuperTestResponse<WhatsNewSeenResponse> = await testApp
        .get(contract.users.getWhatsNewSeen.path)
        .withAuth(testUserId)
        .expect(StatusCodes.OK);

      expect(response.body.lastSeenAt).toBe(lastSeenAt.toISOString());
    });

    it("should return 401 if not authenticated", async () => {
      await testApp
        .get(contract.users.getWhatsNewSeen.path)
        .withoutAuth()
        .expect(StatusCodes.UNAUTHORIZED);
    });

    it("should return 404 when the user has no profile", async () => {
      const userWithoutProfileId = await testApp.createTestUser({
        createProfile: false,
      });

      await testApp
        .get(contract.users.getWhatsNewSeen.path)
        .withAuth(userWithoutProfileId)
        .expect(StatusCodes.NOT_FOUND);
    });

    it("should return 500 when use case returns failure", async () => {
      vi.spyOn(getWhatsNewSeenUseCase, "execute").mockResolvedValue(
        failure(AppError.internal("Database error")),
      );

      await testApp
        .get(contract.users.getWhatsNewSeen.path)
        .withAuth(testUserId)
        .expect(StatusCodes.INTERNAL_SERVER_ERROR);
    });
  });

  describe("markWhatsNewSeen", () => {
    it("should stamp the last-seen timestamp and return it", async () => {
      const response: SuperTestResponse<WhatsNewSeenResponse> = await testApp
        .post(contract.users.markWhatsNewSeen.path)
        .withAuth(testUserId)
        .send({})
        .expect(StatusCodes.OK);

      expect(response.body.lastSeenAt).toEqual(expect.any(String));

      // Verify the timestamp was persisted in the database
      const profs = await testApp.database
        .select()
        .from(profiles)
        .where(eq(profiles.userId, testUserId));
      expect(profs.length).toBe(1);
      expect(profs[0].whatsNewLastSeenAt).not.toBeNull();
      expect(profs[0].whatsNewLastSeenAt?.toISOString()).toBe(response.body.lastSeenAt);
    });

    it("should return the new timestamp on subsequent getWhatsNewSeen calls", async () => {
      // Arrange: mark as seen first
      const markResponse: SuperTestResponse<WhatsNewSeenResponse> = await testApp
        .post(contract.users.markWhatsNewSeen.path)
        .withAuth(testUserId)
        .send({})
        .expect(StatusCodes.OK);

      // Act
      const getResponse: SuperTestResponse<WhatsNewSeenResponse> = await testApp
        .get(contract.users.getWhatsNewSeen.path)
        .withAuth(testUserId)
        .expect(StatusCodes.OK);

      // Assert
      expect(getResponse.body.lastSeenAt).toBe(markResponse.body.lastSeenAt);
    });

    it("should return 401 if not authenticated", async () => {
      await testApp
        .post(contract.users.markWhatsNewSeen.path)
        .withoutAuth()
        .send({})
        .expect(StatusCodes.UNAUTHORIZED);
    });

    it("should return 404 when the user has no profile", async () => {
      const userWithoutProfileId = await testApp.createTestUser({
        createProfile: false,
      });

      await testApp
        .post(contract.users.markWhatsNewSeen.path)
        .withAuth(userWithoutProfileId)
        .send({})
        .expect(StatusCodes.NOT_FOUND);
    });

    it("should return 500 when use case returns failure", async () => {
      vi.spyOn(markWhatsNewSeenUseCase, "execute").mockResolvedValue(
        failure(AppError.internal("Database error")),
      );

      await testApp
        .post(contract.users.markWhatsNewSeen.path)
        .withAuth(testUserId)
        .send({})
        .expect(StatusCodes.INTERNAL_SERVER_ERROR);
    });
  });
});
