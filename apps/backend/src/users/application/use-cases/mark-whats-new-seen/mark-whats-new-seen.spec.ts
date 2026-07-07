import { profiles, eq } from "@repo/database";

import { assertFailure, assertSuccess } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { MarkWhatsNewSeenUseCase } from "./mark-whats-new-seen";

describe("MarkWhatsNewSeenUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let markWhatsNewSeenUseCase: MarkWhatsNewSeenUseCase;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    markWhatsNewSeenUseCase = testApp.module.get(MarkWhatsNewSeenUseCase);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("should stamp the last-seen timestamp and return it", async () => {
    // Act
    const result = await markWhatsNewSeenUseCase.execute(testUserId);

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

  it("should update an existing last-seen timestamp to a newer one", async () => {
    // Arrange: stamp an old last-seen timestamp directly in the database
    const previousSeenAt = new Date("2020-01-01T00:00:00.000Z");
    await testApp.database
      .update(profiles)
      .set({ whatsNewLastSeenAt: previousSeenAt })
      .where(eq(profiles.userId, testUserId));

    // Act
    const result = await markWhatsNewSeenUseCase.execute(testUserId);

    // Assert
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value).toBeInstanceOf(Date);
    expect(result.value?.getTime()).toBeGreaterThan(previousSeenAt.getTime());
  });

  it("should return NOT_FOUND when no profile exists for the user", async () => {
    // Arrange: create a user without a profile row
    const userWithoutProfileId = await testApp.createTestUser({
      createProfile: false,
    });

    // Act
    const result = await markWhatsNewSeenUseCase.execute(userWithoutProfileId);

    // Assert
    expect(result.isSuccess()).toBe(false);
    expect(result._tag).toBe("failure");
    assertFailure(result);
    expect(result.error.code).toBe("NOT_FOUND");
  });

  it("should return NOT_FOUND for a non-existent user id", async () => {
    const nonExistentId = "00000000-0000-0000-0000-000000000000";

    const result = await markWhatsNewSeenUseCase.execute(nonExistentId);

    expect(result.isSuccess()).toBe(false);
    expect(result._tag).toBe("failure");
    assertFailure(result);
    expect(result.error.code).toBe("NOT_FOUND");
  });
});
