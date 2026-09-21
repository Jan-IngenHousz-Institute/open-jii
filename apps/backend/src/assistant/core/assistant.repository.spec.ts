import { assistantUsageEvents, createSecondaryDatabase, eq } from "@repo/database";

import { TestHarness } from "../../test/test-harness";
import { AssistantRepository } from "./assistant.repository";

describe("AssistantRepository quota reservations", () => {
  const testApp = TestHarness.App;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("allows only one concurrent turn to reserve a user's remaining daily budget", async () => {
    const userId = await testApp.createTestUser({ name: "Quota user" });
    const first = createSecondaryDatabase();
    const second = createSecondaryDatabase();
    try {
      const [left, right] = await Promise.all([
        new AssistantRepository(first.database).reserveTurnBudget(userId, 1_000, 1_000),
        new AssistantRepository(second.database).reserveTurnBudget(userId, 1_000, 1_000),
      ]);

      expect([left, right].filter(Boolean)).toHaveLength(1);
      expect([left, right].filter((reservation) => reservation === null)).toHaveLength(1);
      const winner = left ?? right;
      if (!winner) throw new Error("Expected one quota reservation");
      expect(winner.reservedTokens).toBe(1_000);
    } finally {
      await Promise.all([first.close(), second.close()]);
    }
  });

  it("reconciles exact usage and retains the reservation when accounting is incomplete", async () => {
    const userId = await testApp.createTestUser({ name: "Accounting user" });
    const repository = new AssistantRepository(testApp.database);
    const exact = await repository.reserveTurnBudget(userId, 1_000, 1_000);
    if (!exact) throw new Error("Expected exact quota reservation");
    await repository.reconcileTurnBudget({
      reservationId: exact.reservationId,
      userId,
      inputTokens: 120,
      outputTokens: 30,
      usageComplete: true,
      status: "failed",
    });
    expect(await repository.dailyTokens(userId)).toBe(150);

    const incomplete = await repository.reserveTurnBudget(userId, 1_000, 1_000);
    if (!incomplete) throw new Error("Expected incomplete quota reservation");
    expect(incomplete.reservedTokens).toBe(850);
    await repository.reconcileTurnBudget({
      reservationId: incomplete.reservationId,
      userId,
      inputTokens: 50,
      outputTokens: 10,
      usageComplete: false,
      status: "failed",
    });

    expect(await repository.dailyTokens(userId)).toBe(1_000);
    expect(await repository.reserveTurnBudget(userId, 1_000, 1_000)).toBeNull();
    const [event] = await testApp.database
      .select({ metadata: assistantUsageEvents.metadata })
      .from(assistantUsageEvents)
      .where(eq(assistantUsageEvents.id, incomplete.reservationId));
    expect(event.metadata).toMatchObject({
      status: "failed",
      usageComplete: false,
      lowerBoundInputTokens: 50,
      lowerBoundOutputTokens: 10,
      reservedTokens: 850,
    });
  });

  it("paginates reuse sorting with the full stable sort tuple", async () => {
    const userId = await testApp.createTestUser({ name: "Starter user" });
    const repository = new AssistantRepository(testApp.database);
    const popular = await testApp.createMacro({
      name: "Popular",
      createdBy: userId,
      visibility: "public",
    });
    const tied = await testApp.createMacro({
      name: "Tied",
      createdBy: userId,
      visibility: "public",
    });
    const occasional = await testApp.createMacro({
      name: "Occasional",
      createdBy: userId,
      visibility: "public",
    });
    for (const [sourceId, copies] of [
      [popular.id, 3],
      [tied.id, 3],
      [occasional.id, 1],
    ] as const) {
      for (let index = 0; index < copies; index += 1) {
        await repository.recordStarterCopy({
          sourceType: "macro",
          sourceId,
          createdType: "macro",
          createdId: crypto.randomUUID(),
          userId,
        });
      }
    }

    const first = await repository.listStarters({ type: "macro", sort: "reuse", limit: 2 });
    if (!first.nextCursor) throw new Error("Expected a second starter page");
    const second = await repository.listStarters({
      type: "macro",
      sort: "reuse",
      limit: 2,
      cursor: first.nextCursor,
    });

    expect(first.nextCursor).not.toBeNull();
    expect([...first.items, ...second.items].map((item) => item.id)).toHaveLength(3);
    expect(new Set([...first.items, ...second.items].map((item) => item.id)).size).toBe(3);
    expect(second.nextCursor).toBeNull();
  });
});
