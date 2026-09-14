import { expect } from "vitest";

import { GetExperimentTablesUseCase } from "../../experiments/application/use-cases/experiment-data/get-experiment-tables";
import type { ExperimentTablesMetadataDto } from "../../experiments/application/use-cases/experiment-data/get-experiment-tables";
import { TestHarness } from "../../test/test-harness";
import { success } from "../utils/fp-utils";

describe("CompressionMiddleware", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let experimentId: string;

  // Well past the middleware's 1 KB threshold, below which bodies go out as is.
  const tables: ExperimentTablesMetadataDto = Array.from({ length: 200 }, (_, index) => ({
    identifier: `macro-${index}`,
    tableType: "macro",
    displayName: `Processed Data (${index})`,
    totalRows: index,
  }));

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    const { experiment } = await testApp.createExperiment({
      name: "Compressed experiment",
      userId: testUserId,
    });
    experimentId = experiment.id;
    const getExperimentTablesUseCase = testApp.module.get(GetExperimentTablesUseCase);
    vi.spyOn(getExperimentTablesUseCase, "execute").mockResolvedValue(success(tables));
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("gzips a large JSON response when the client accepts it", async () => {
    const response = await testApp
      .get(`/api/v1/experiments/${experimentId}/tables`)
      .withAuth(testUserId)
      .set("Accept-Encoding", "gzip")
      .expect(200);

    expect(response.headers["content-encoding"]).toBe("gzip");
    expect(response.body).toEqual(tables);
  });

  it("sends the body as is when the client does not accept compression", async () => {
    const response = await testApp
      .get(`/api/v1/experiments/${experimentId}/tables`)
      .withAuth(testUserId)
      .set("Accept-Encoding", "identity")
      .expect(200);

    expect(response.headers["content-encoding"]).toBeUndefined();
    expect(response.body).toEqual(tables);
  });

  it("leaves small responses alone", async () => {
    const response = await testApp.get("/health").set("Accept-Encoding", "gzip").expect(200);

    expect(response.headers["content-encoding"]).toBeUndefined();
  });
});
