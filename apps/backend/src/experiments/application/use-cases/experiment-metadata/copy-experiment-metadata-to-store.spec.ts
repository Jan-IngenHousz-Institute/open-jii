import { and, eq, experimentDataOutbox } from "@repo/database";

import { assertFailure, assertSuccess } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { SERVING_STORE_COPIES_PORT } from "../../../core/ports/serving-store-copies.port";
import type { ServingStoreCopiesPort } from "../../../core/ports/serving-store-copies.port";
import { ExperimentDataOutboxWorker } from "../../services/experiment-data-outbox.worker";
import { CopyExperimentMetadataToStoreUseCase } from "./copy-experiment-metadata-to-store";
import { CreateExperimentMetadataUseCase } from "./create-experiment-metadata";

describe("CopyExperimentMetadataToStoreUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let experimentId: string;
  let useCase: CopyExperimentMetadataToStoreUseCase;

  const store = () => testApp.module.get<ServingStoreCopiesPort>(SERVING_STORE_COPIES_PORT);

  async function save() {
    const created = await testApp.module
      .get(CreateExperimentMetadataUseCase)
      .execute(experimentId, { metadata: { location: "GH 8.3" } }, testUserId);
    assertSuccess(created);
    return created.value.metadataId;
  }

  function storeRows(sheetId: string) {
    return testApp.database
      .select()
      .from(experimentDataOutbox)
      .where(
        and(
          eq(experimentDataOutbox.recordId, sheetId),
          eq(experimentDataOutbox.destination, "serving_store"),
        ),
      );
  }

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    const { experiment } = await testApp.createExperiment({ name: "Plots", userId: testUserId });
    experimentId = experiment.id;
    useCase = testApp.module.get(CopyExperimentMetadataToStoreUseCase);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("owes a failed sheet to the store again, due now with its attempts forgotten, and starts the copy", async () => {
    vi.spyOn(store(), "isConfigured").mockReturnValue(true);
    const nudge = vi.spyOn(testApp.module.get(ExperimentDataOutboxWorker), "nudge");
    const sheetId = await save();
    await testApp.database
      .update(experimentDataOutbox)
      .set({ attempts: 5, lastError: "The serving store could not take the copy" })
      .where(eq(experimentDataOutbox.recordId, sheetId));

    assertSuccess(await useCase.execute(experimentId, sheetId, testUserId));

    expect(await storeRows(sheetId)).toEqual([
      expect.objectContaining({ attempts: 0, lastError: null, claimedAt: null }),
    ]);
    expect(nudge).toHaveBeenCalled();
  });

  it("owes a sheet whose copy landed long ago", async () => {
    vi.spyOn(store(), "isConfigured").mockReturnValue(true);
    const sheetId = await save();
    await testApp.database
      .delete(experimentDataOutbox)
      .where(eq(experimentDataOutbox.recordId, sheetId));

    assertSuccess(await useCase.execute(experimentId, sheetId, testUserId));

    expect(await storeRows(sheetId)).toEqual([expect.objectContaining({ experimentId })]);
  });

  it("refuses where there is no store, and a sheet of another experiment", async () => {
    const sheetId = await save();
    const noStore = await useCase.execute(experimentId, sheetId, testUserId);
    assertFailure(noStore);
    expect(noStore.error.code).toBe("STORE_NOT_CONFIGURED");

    vi.spyOn(store(), "isConfigured").mockReturnValue(true);
    const { experiment: other } = await testApp.createExperiment({
      name: "Another",
      userId: testUserId,
    });
    const elsewhere = await useCase.execute(other.id, sheetId, testUserId);
    assertFailure(elsewhere);
    expect(elsewhere.error.code).toBe("NOT_FOUND");
  });
});
