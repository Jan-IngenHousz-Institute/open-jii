import { profiles, eq } from "@repo/database";

import { assertFailure, assertSuccess } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { GetWhatsNewSeenUseCase } from "./get-whats-new-seen";

describe("GetWhatsNewSeenUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let getWhatsNewSeenUseCase: GetWhatsNewSeenUseCase;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    getWhatsNewSeenUseCase = testApp.module.get(GetWhatsNewSeenUseCase);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("should return null when the user has never opened the What's new panel", async () => {
    // Act
    const result = await getWhatsNewSeenUseCase.execute(testUserId);

    // Assert
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value).toBeNull();
  });

  it("should return the last-seen timestamp when the user has opened the panel before", async () => {
    // Arrange: stamp a last-seen timestamp directly in the database
    const lastSeenAt = new Date("2026-01-15T10:30:00.000Z");
    await testApp.database
      .update(profiles)
      .set({ whatsNewLastSeenAt: lastSeenAt })
      .where(eq(profiles.userId, testUserId));

    // Act
    const result = await getWhatsNewSeenUseCase.execute(testUserId);

    // Assert
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value).toBeInstanceOf(Date);
    expect(result.value?.getTime()).toBe(lastSeenAt.getTime());
  });

  it("should return NOT_FOUND when no profile exists for the user", async () => {
    // Arrange: create a user without a profile row
    const userWithoutProfileId = await testApp.createTestUser({
      createProfile: false,
    });

    // Act
    const result = await getWhatsNewSeenUseCase.execute(userWithoutProfileId);

    // Assert
    expect(result.isSuccess()).toBe(false);
    expect(result._tag).toBe("failure");
    assertFailure(result);
    expect(result.error.code).toBe("NOT_FOUND");
  });

  it("should return NOT_FOUND for a non-existent user id", async () => {
    const nonExistentId = "00000000-0000-0000-0000-000000000000";

    const result = await getWhatsNewSeenUseCase.execute(nonExistentId);

    expect(result.isSuccess()).toBe(false);
    expect(result._tag).toBe("failure");
    assertFailure(result);
    expect(result.error.code).toBe("NOT_FOUND");
  });
});
