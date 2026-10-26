import { faker } from "@faker-js/faker";

import { assertSuccess } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { SearchUsersUseCase } from "./search-users";

describe("SearchUsersUseCase", () => {
  const testApp = TestHarness.App;
  let callerId: string;
  let useCase: SearchUsersUseCase;

  const search = (query: string, page: { limit?: number; offset?: number } = {}) =>
    useCase.execute(callerId, { query, limit: page.limit ?? 20, offset: page.offset ?? 0 });

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    callerId = await testApp.createTestUser({ email: "caller@example.com" });
    useCase = testApp.module.get(SearchUsersUseCase);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("finds a stranger by name without their address", async () => {
    // Unique so the trigram match cannot pull in the ambient random-named users.
    const firstName = `Alice${faker.string.alphanumeric(10)}`;
    const strangerId = await testApp.createTestUser({
      name: `${firstName} Smith`,
      email: "alice.stranger@example.com",
    });

    const result = await search(firstName);

    assertSuccess(result);
    expect(result.value.map((user) => user.userId)).toEqual([strangerId]);
    expect(result.value[0].email).toBeNull();
    expect(JSON.stringify(result.value)).not.toContain("alice.stranger@example.com");
  });

  it("resolves a stranger by complete address without echoing it", async () => {
    const email = `invitee${faker.string.alphanumeric(10).toLowerCase()}@example.com`;
    const strangerId = await testApp.createTestUser({ name: "Invitee Person", email });

    const result = await search(email.toUpperCase());

    assertSuccess(result);
    expect(result.value.map((user) => user.userId)).toEqual([strangerId]);
    expect(result.value[0].email).toBeNull();
    expect(JSON.stringify(result.value).toLowerCase()).not.toContain(email);
  });

  it("does not match an address by fragment", async () => {
    const strangerId = await testApp.createTestUser({
      name: "Zelda Quux",
      email: "zorptastic@zorpmail.example",
    });

    const result = await search("zorptastic");

    assertSuccess(result);
    expect(result.value.map((user) => user.userId)).not.toContain(strangerId);
  });

  it("shows an organization admin the addresses of its members", async () => {
    const orgId = await testApp.createOrganization();
    await testApp.addOrganizationMember(orgId, callerId, "admin");
    const firstName = `Member${faker.string.alphanumeric(10)}`;
    const memberId = await testApp.createTestUser({
      name: `${firstName} Smith`,
      email: "member@example.com",
    });
    await testApp.addOrganizationMember(orgId, memberId, "member");

    const result = await search(firstName);

    assertSuccess(result);
    expect(result.value).toEqual([
      expect.objectContaining({ userId: memberId, email: "member@example.com" }),
    ]);
  });

  it("withholds a fellow member's address from a plain member", async () => {
    const orgId = await testApp.createOrganization();
    await testApp.addOrganizationMember(orgId, callerId, "member");
    const firstName = `Owner${faker.string.alphanumeric(10)}`;
    const ownerId = await testApp.createTestUser({
      name: `${firstName} Smith`,
      email: "owner@example.com",
    });
    await testApp.addOrganizationMember(orgId, ownerId, "owner");

    const result = await search(firstName);

    assertSuccess(result);
    expect(result.value).toEqual([expect.objectContaining({ userId: ownerId, email: null })]);
  });

  it("shows the caller their own address", async () => {
    const result = await search("caller@example.com");

    assertSuccess(result);
    expect(result.value).toEqual([
      expect.objectContaining({ userId: callerId, email: "caller@example.com" }),
    ]);
  });

  it("pages through name matches with every address withheld", async () => {
    for (let i = 0; i < 5; i++) {
      await testApp.createTestUser({ name: `Pagewright ${i}`, email: `page${i}@example.com` });
    }

    const firstPage = await search("Pagewright", { limit: 2, offset: 0 });
    const secondPage = await search("Pagewright", { limit: 2, offset: 2 });
    const lastPage = await search("Pagewright", { limit: 2, offset: 4 });

    assertSuccess(firstPage);
    assertSuccess(secondPage);
    assertSuccess(lastPage);
    expect([firstPage, secondPage, lastPage].map((page) => page.value.length)).toEqual([2, 2, 1]);
    const ids = [...firstPage.value, ...secondPage.value, ...lastPage.value].map((u) => u.userId);
    expect(new Set(ids).size).toBe(5);
    for (const page of [firstPage, secondPage, lastPage]) {
      expect(page.value.every((user) => user.email === null)).toBe(true);
    }
  });

  it("should return empty array if no users match the search query", async () => {
    const result = await search("nonexistentuser");

    assertSuccess(result);
    expect(result.value).toEqual([]);
  });
});
