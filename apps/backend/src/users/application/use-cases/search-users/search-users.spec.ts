import { assertSuccess } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { SearchUsersUseCase } from "./search-users";

describe("SearchUsersUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: SearchUsersUseCase;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(SearchUsersUseCase);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("should search users without any query parameters", async () => {
    // Arrange
    const user1Id = await testApp.createTestUser({
      email: "alice@example.com",
    });
    const user2Id = await testApp.createTestUser({
      email: "bob@example.com",
    });

    // Act
    const result = await useCase.execute({});

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
    const result = await useCase.execute({ query: "Alice" });

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
    const result = await useCase.execute({ query: "alice@example.com" });

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
    const result = await useCase.execute({ query: "Alice" });

    // Assert
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    const foundUsers = result.value;
    expect(foundUsers.length).toBe(2);
    expect(foundUsers.every((u) => u.name?.includes("Alice") ?? false)).toBe(
      true,
    );
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
    const firstPageResult = await useCase.execute({ limit: 2, offset: 0 });

    // Assert
    expect(firstPageResult.isSuccess()).toBe(true);
    assertSuccess(firstPageResult);
    const firstPageUsers = firstPageResult.value;
    expect(firstPageUsers.length).toBe(2);

    // Act - get next 2 users
    const secondPageResult = await useCase.execute({ limit: 2, offset: 2 });

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
    const result = await useCase.execute({ query: "nonexistentuser" });

    // Assert
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value).toEqual([]);
  });
});
