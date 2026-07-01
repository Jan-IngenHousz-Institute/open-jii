import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api/contract";
import type { GlobalSearchResponse } from "@repo/api/schemas/search.schema";

import { TestHarness } from "../../test/test-harness";

describe("SearchController", () => {
  const testApp = TestHarness.App;
  let userId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    userId = await testApp.createTestUser({});
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("returns 200 with ranked results for a query", async () => {
    await testApp.createProtocol({ name: "Photosynthesis protocol", createdBy: userId });

    const response = await testApp
      .get(contract.search.globalSearch.path)
      .withAuth(userId)
      .query({ query: "photosynthesis" })
      .expect(StatusCodes.OK);

    const body = response.body as GlobalSearchResponse;
    expect(Array.isArray(body.results)).toBe(true);
    expect(body.results.some((result) => result.title === "Photosynthesis protocol")).toBe(true);
  });

  it("returns 400 when the query param is missing", async () => {
    await testApp
      .get(contract.search.globalSearch.path)
      .withAuth(userId)
      .expect(StatusCodes.BAD_REQUEST);
  });
});
