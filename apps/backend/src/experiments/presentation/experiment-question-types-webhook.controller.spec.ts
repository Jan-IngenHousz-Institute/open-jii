import { randomUUID, createHmac } from "crypto";

import { contract } from "@repo/api/contract";
import { experimentQuestionTypes } from "@repo/database";

import { stableStringify } from "../../common/utils/stable-json";
import { TestHarness } from "../../test/test-harness";

const apiKeyId = process.env.DATABRICKS_WEBHOOK_API_KEY_ID ?? "test-api-key-id";
const webhookSecret = process.env.DATABRICKS_WEBHOOK_SECRET ?? "test-webhook-secret";

describe("question storage classification webhook", () => {
  const app = TestHarness.App;
  beforeAll(() => app.setup());
  beforeEach(() => app.beforeEach());
  afterEach(() => app.afterEach());
  afterAll(() => app.teardown());

  function request(experimentIds: string[]) {
    const body = { experimentIds };
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = createHmac("sha256", webhookSecret)
      .update(`${timestamp}:${stableStringify(body)}`)
      .digest("hex");
    return app
      .post(app.resolveOrpcPath(contract.experiments.getExperimentQuestionTypes))
      .set("x-api-key-id", apiKeyId)
      .set("x-databricks-timestamp", timestamp)
      .set("x-databricks-signature", signature)
      .send(body);
  }

  it("requires pipeline authentication", async () => {
    const response = await app
      .post(app.resolveOrpcPath(contract.experiments.getExperimentQuestionTypes))
      .send({ experimentIds: [randomUUID()] });
    expect(response.status).toBe(401);
  });

  it("returns complete deduplicated classifications and excludes inactive history", async () => {
    const userId = await app.createTestUser({});
    const id = (await app.createExperiment({ userId, name: "Question types" })).experiment.id;
    await app.database.insert(experimentQuestionTypes).values([
      { experimentId: id, key: "height", declaredClass: "number", active: true },
      { experimentId: id, key: "unproven", declaredClass: "number", active: false },
      { experimentId: id, key: "plot", declaredClass: "text", active: false },
    ]);
    const missing = randomUUID();
    const response = await request([id, missing, id, id.toUpperCase()]);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      experiments: [
        { experimentId: id, numericKeys: ["height"] },
        { experimentId: missing, numericKeys: [] },
        { experimentId: id.toUpperCase(), numericKeys: ["height"] },
      ],
    });
  });

  it.each([
    { ids: [] },
    { ids: ["bad-uuid"] },
    { ids: Array.from({ length: 501 }, () => randomUUID()) },
  ])("rejects an invalid batch", async ({ ids }) => {
    const response = await request(ids);
    expect(response.status).toBe(400);
  });
});
