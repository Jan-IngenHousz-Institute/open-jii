import { faker } from "@faker-js/faker";

import { resourceGrants } from "@repo/database";

import {
  AppError,
  assertFailure,
  assertSuccess,
  failure,
  success,
} from "../../../common/utils/fp-utils";
import { ExperimentRepository } from "../../../experiments/core/repositories/experiment.repository";
import { TestHarness } from "../../../test/test-harness";
import { IOT_DATABRICKS_PORT } from "../../core/ports/databricks.port";
import type { DatabricksPort } from "../../core/ports/databricks.port";
import { IOT_SERVING_STORE_PORT } from "../../core/ports/serving-store.port";
import type { ServingStorePort } from "../../core/ports/serving-store.port";
import { ReadableDeviceExperimentsService } from "./readable-device-experiments.service";

const THING = "AMBYTE_A";
const FROM = "2026-08-13T00:00:00.000Z";
const TO = "2026-08-13T12:00:00.000Z";

describe("ReadableDeviceExperimentsService", () => {
  const testApp = TestHarness.App;
  let service: ReadableDeviceExperimentsService;
  let warehouse: DatabricksPort;
  let servingStore: ServingStorePort;
  let experimentRepository: ExperimentRepository;
  let userId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    service = testApp.module.get(ReadableDeviceExperimentsService);
    warehouse = testApp.module.get(IOT_DATABRICKS_PORT);
    servingStore = testApp.module.get(IOT_SERVING_STORE_PORT);
    experimentRepository = testApp.module.get(ExperimentRepository);
    userId = await testApp.createTestUser({ name: "Viewer" });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("keeps exactly the claimed experiments checkAccess lets the caller read", async () => {
    const owner = await testApp.createTestUser({ name: "Owner" });
    const organizationId = await testApp.createOrganization();
    await testApp.addOrganizationMember(organizationId, userId);
    const { experiment: own } = await testApp.createExperiment({ name: "Own", userId });
    const { experiment: shared } = await testApp.createExperiment({
      name: "Shared",
      userId: owner,
    });
    const { experiment: inOrganization } = await testApp.createExperiment({
      name: "In organization",
      userId: owner,
      organizationId,
    });
    const { experiment: published } = await testApp.createExperiment({
      name: "Published",
      userId: owner,
      visibility: "public",
    });
    const { experiment: hidden } = await testApp.createExperiment({
      name: "Hidden",
      userId: owner,
    });
    await testApp.addExperimentCollaborator(shared.id, userId);
    const claimedIds = [own.id, shared.id, inOrganization.id, published.id, hidden.id];
    const claimed = vi
      .spyOn(servingStore, "getDeviceExperimentIds")
      .mockResolvedValue(success(claimedIds));

    const result = await service.list(THING, userId, "store", { from: FROM, to: TO });

    assertSuccess(result);
    expect(result.value).toEqual([own.id, shared.id, inOrganization.id, published.id]);
    expect(claimed).toHaveBeenCalledWith(THING, { from: FROM, to: TO });

    const checked = await Promise.all(
      claimedIds.map((experimentId) => experimentRepository.checkAccess(experimentId, userId)),
    );
    const readByCheckAccess = claimedIds.filter((_, index) => {
      const access = checked[index];
      assertSuccess(access);
      return access.value.hasAccess;
    });
    expect(result.value).toEqual(readByCheckAccess);
  });

  it("drops a grant whose role carries no read, as checkAccess does", async () => {
    const owner = await testApp.createTestUser({ name: "Owner" });
    const { experiment } = await testApp.createExperiment({ name: "Stale grant", userId: owner });
    await testApp.database.insert(resourceGrants).values({
      resourceType: "experiment",
      resourceId: experiment.id,
      granteeType: "user",
      granteeId: userId,
      role: "retired",
    });
    vi.spyOn(servingStore, "getDeviceExperimentIds").mockResolvedValue(success([experiment.id]));

    const result = await service.list(THING, userId, "store", { from: FROM, to: TO });

    assertSuccess(result);
    expect(result.value).toEqual([]);
    const access = await experimentRepository.checkAccess(experiment.id, userId);
    assertSuccess(access);
    expect(access.value.hasAccess).toBe(false);
  });

  it("reads access for every claimed experiment in one query", async () => {
    const { experiment } = await testApp.createExperiment({ name: "Own", userId });
    const unknownIds = Array.from({ length: 100 }, () => faker.string.uuid());
    vi.spyOn(servingStore, "getDeviceExperimentIds").mockResolvedValue(
      success([...unknownIds, experiment.id]),
    );
    const readable = vi.spyOn(experimentRepository, "findReadableIds");
    const perExperiment = vi.spyOn(experimentRepository, "checkAccess");

    const result = await service.list(THING, userId, "store", { from: FROM, to: TO });

    assertSuccess(result);
    expect(result.value).toEqual([experiment.id]);
    expect(readable).toHaveBeenCalledTimes(1);
    expect(readable).toHaveBeenCalledWith([...unknownIds, experiment.id], userId);
    expect(perExperiment).not.toHaveBeenCalled();
  });

  it("fails when the caller's access cannot be read", async () => {
    const { experiment } = await testApp.createExperiment({ name: "Own", userId });
    vi.spyOn(servingStore, "getDeviceExperimentIds").mockResolvedValue(success([experiment.id]));
    vi.spyOn(experimentRepository, "findReadableIds").mockResolvedValue(
      failure(AppError.internal("postgres down")),
    );

    const result = await service.list(THING, userId, "store", { from: FROM, to: TO });

    assertFailure(result);
    expect(result.error.message).toBe("postgres down");
  });

  it("reads no experiment in a claim that is no uuid, rather than failing the page", async () => {
    const { experiment } = await testApp.createExperiment({ name: "Own", userId });
    vi.spyOn(warehouse, "getDeviceExperimentIds").mockResolvedValue(
      success(["not-an-experiment", experiment.id]),
    );

    const result = await service.list(THING, userId, "warehouse", { from: FROM, to: TO });

    assertSuccess(result);
    expect(result.value).toEqual([experiment.id]);
  });

  it("keeps a readable claim spelled in capitals, as it was claimed", async () => {
    const { experiment } = await testApp.createExperiment({ name: "Own", userId });
    const owner = await testApp.createTestUser({ name: "Owner" });
    const { experiment: hidden } = await testApp.createExperiment({
      name: "Hidden",
      userId: owner,
    });
    const claimed = [experiment.id.toUpperCase(), hidden.id.toUpperCase()];
    vi.spyOn(warehouse, "getDeviceExperimentIds").mockResolvedValue(success(claimed));

    const result = await service.list(THING, userId, "warehouse", { from: FROM, to: TO });

    assertSuccess(result);
    expect(result.value).toEqual([experiment.id.toUpperCase()]);
  });

  it("asks the source the device's rows come from", async () => {
    const claimed = vi.spyOn(warehouse, "getDeviceExperimentIds").mockResolvedValue(success([]));

    const result = await service.list(THING, userId, "warehouse", { from: FROM, to: TO });

    assertSuccess(result);
    expect(result.value).toEqual([]);
    expect(claimed).toHaveBeenCalledWith(THING, { from: FROM, to: TO });
  });

  it("fails when the device's experiments cannot be read", async () => {
    vi.spyOn(servingStore, "getDeviceExperimentIds").mockResolvedValue(
      failure(AppError.internal("store down")),
    );

    const result = await service.list(THING, userId, "store", { from: FROM, to: TO });

    assertFailure(result);
    expect(result.error.message).toBe("store down");
  });
});
