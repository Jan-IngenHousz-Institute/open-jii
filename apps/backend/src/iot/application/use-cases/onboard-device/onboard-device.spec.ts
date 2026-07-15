import { faker } from "@faker-js/faker";

import { and, eq, experimentMembers, experiments, workbookVersions } from "@repo/database";

import { AwsAdapter } from "../../../../common/modules/aws/aws.adapter";
import {
  AppError,
  assertFailure,
  assertSuccess,
  failure,
  success,
} from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { ExperimentDeviceRepository } from "../../../core/repositories/experiment-device.repository";
import { OnboardDeviceUseCase } from "./onboard-device";

const ENDPOINT = "abc123-ats.iot.eu-central-1.amazonaws.com";

describe("OnboardDeviceUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: OnboardDeviceUseCase;
  let repository: ExperimentDeviceRepository;
  let awsAdapter: AwsAdapter;
  let userId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    userId = await testApp.createTestUser({ name: "Owner" });
    useCase = testApp.module.get(OnboardDeviceUseCase);
    repository = testApp.module.get(ExperimentDeviceRepository);
    awsAdapter = testApp.module.get(AwsAdapter);
    vi.spyOn(awsAdapter, "getIotDataEndpoint").mockResolvedValue(success(ENDPOINT));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  const createActiveDevice = (createdBy: string) =>
    testApp.createIotDevice({ createdBy, status: "active" });

  const pinWorkbookVersion = async (experimentId: string) => {
    const workbook = await testApp.createWorkbook({ name: "WB", createdBy: userId });
    const cells = [
      { id: faker.string.uuid(), type: "markdown", content: "hi", isCollapsed: false },
    ];
    const [version] = await testApp.database
      .insert(workbookVersions)
      .values({
        workbookId: workbook.id,
        version: 1,
        cells,
        metadata: {},
        entitySnapshots: { protocols: {}, macros: {} },
        createdBy: userId,
      })
      .returning();
    await testApp.database
      .update(experiments)
      .set({ workbookId: workbook.id, workbookVersionId: version.id })
      .where(eq(experiments.id, experimentId));
    return version;
  };

  it("binds the device and returns the full config", async () => {
    const device = await createActiveDevice(userId);
    const { experiment } = await testApp.createExperiment({ name: "Photosynthesis", userId });

    const result = await useCase.execute(device.id, [experiment.id], userId);

    assertSuccess(result);
    expect(result.value.thingName).toBe(device.thingName);
    expect(result.value.deviceType).toBe(device.deviceType);
    expect(result.value.endpoint).toBe(ENDPOINT);
    expect(result.value.experiments).toHaveLength(1);
    expect(result.value.experiments[0].topicPrefix).toBe(
      `experiment/data_ingest/v1/${experiment.id}/${device.deviceType}`,
    );
    expect(result.value.experiments[0].workbook).toBeNull();

    const bound = await repository.listExperimentsByDeviceForOwner(device.id, userId);
    assertSuccess(bound);
    expect(bound.value).toHaveLength(1);
  });

  it("re-onboarding with an empty body returns the full config without new bindings", async () => {
    const device = await createActiveDevice(userId);
    const { experiment } = await testApp.createExperiment({ name: "E", userId });
    await useCase.execute(device.id, [experiment.id], userId);

    const result = await useCase.execute(device.id, [], userId);

    assertSuccess(result);
    expect(result.value.experiments).toHaveLength(1);
    expect(result.value.experiments[0].experimentId).toBe(experiment.id);
  });

  it("onboarding twice with the same experiment is a no-op, not a conflict", async () => {
    const device = await createActiveDevice(userId);
    const { experiment } = await testApp.createExperiment({ name: "E", userId });

    await useCase.execute(device.id, [experiment.id], userId);
    const result = await useCase.execute(device.id, [experiment.id], userId);

    assertSuccess(result);
    expect(result.value.experiments).toHaveLength(1);
  });

  it("allows a plain member (not admin) to onboard", async () => {
    const member = await testApp.createTestUser({});
    const { experiment } = await testApp.createExperiment({ name: "E", userId });
    await testApp.addExperimentMember(experiment.id, member, "member");
    const device = await createActiveDevice(member);

    const result = await useCase.execute(device.id, [experiment.id], member);

    assertSuccess(result);
    expect(result.value.experiments).toHaveLength(1);
  });

  it("rejects a non-member of the experiment", async () => {
    const stranger = await testApp.createTestUser({});
    const { experiment } = await testApp.createExperiment({ name: "E", userId });
    const device = await createActiveDevice(stranger);

    const result = await useCase.execute(device.id, [experiment.id], stranger);

    assertFailure(result);
    expect(result.error.statusCode).toBe(403);
  });

  it("rejects onboarding to an archived experiment", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "E",
      userId,
      status: "archived",
    });
    const device = await createActiveDevice(userId);

    const result = await useCase.execute(device.id, [experiment.id], userId);

    assertFailure(result);
    expect(result.error.statusCode).toBe(403);
  });

  it("rejects a device without active credentials", async () => {
    const pending = await testApp.createIotDevice({ createdBy: userId, status: "pending" });
    const revoked = await testApp.createIotDevice({ createdBy: userId, status: "revoked" });
    const { experiment } = await testApp.createExperiment({ name: "E", userId });

    const pendingResult = await useCase.execute(pending.id, [experiment.id], userId);
    assertFailure(pendingResult);
    expect(pendingResult.error.statusCode).toBe(400);

    const revokedResult = await useCase.execute(revoked.id, [experiment.id], userId);
    assertFailure(revokedResult);
    expect(revokedResult.error.statusCode).toBe(400);
  });

  it("returns not found for another owner's device", async () => {
    const stranger = await testApp.createTestUser({});
    const device = await createActiveDevice(stranger);
    const { experiment } = await testApp.createExperiment({ name: "E", userId });

    const result = await useCase.execute(device.id, [experiment.id], userId);

    assertFailure(result);
    expect(result.error.statusCode).toBe(404);
  });

  it("returns not found for an unknown experiment", async () => {
    const device = await createActiveDevice(userId);

    const result = await useCase.execute(device.id, [faker.string.uuid()], userId);

    assertFailure(result);
    expect(result.error.statusCode).toBe(404);
  });

  it("includes the pinned workbook version in the config", async () => {
    const device = await createActiveDevice(userId);
    const { experiment } = await testApp.createExperiment({ name: "Pinned", userId });
    const version = await pinWorkbookVersion(experiment.id);

    const result = await useCase.execute(device.id, [experiment.id], userId);

    assertSuccess(result);
    const workbook = result.value.experiments[0].workbook;
    expect(workbook?.version).toBe(version.version);
    expect(workbook?.cells).toHaveLength(1);
    expect(workbook?.entitySnapshots).toEqual({ protocols: {}, macros: {} });
  });

  it("fails before binding when the endpoint cannot be resolved", async () => {
    vi.spyOn(awsAdapter, "getIotDataEndpoint").mockResolvedValue(
      failure(AppError.internal("endpoint unavailable")),
    );
    const device = await createActiveDevice(userId);
    const { experiment } = await testApp.createExperiment({ name: "E", userId });

    const result = await useCase.execute(device.id, [experiment.id], userId);

    assertFailure(result);
    expect(result.error.message).toBe("endpoint unavailable");

    // The failure must not leave the onboard half-applied.
    const bound = await repository.listExperimentsByDeviceForOwner(device.id, userId);
    assertSuccess(bound);
    expect(bound.value).toEqual([]);
  });

  it("excludes experiments the caller lost access to from the re-issued config", async () => {
    const member = await testApp.createTestUser({});
    const { experiment } = await testApp.createExperiment({ name: "Private", userId });
    await testApp.addExperimentMember(experiment.id, member, "member");
    const device = await createActiveDevice(member);
    await useCase.execute(device.id, [experiment.id], member);

    await testApp.database
      .delete(experimentMembers)
      .where(
        and(
          eq(experimentMembers.experimentId, experiment.id),
          eq(experimentMembers.userId, member),
        ),
      );

    const result = await useCase.execute(device.id, [], member);

    assertSuccess(result);
    expect(result.value.experiments).toEqual([]);
  });

  it("excludes since-archived experiments from the re-issued config", async () => {
    const device = await createActiveDevice(userId);
    const { experiment } = await testApp.createExperiment({ name: "E", userId });
    await useCase.execute(device.id, [experiment.id], userId);

    await testApp.database
      .update(experiments)
      .set({ status: "archived" })
      .where(eq(experiments.id, experiment.id));

    const result = await useCase.execute(device.id, [], userId);

    assertSuccess(result);
    expect(result.value.experiments).toEqual([]);
  });
});
