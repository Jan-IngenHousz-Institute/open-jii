import { faker } from "@faker-js/faker";
import type { MockInstance } from "vitest";

import type { DeviceOnboardingConfig } from "@repo/api/domains/iot/iot.schema";
import { eq, experiments, workbookVersions } from "@repo/database";

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
import { RepublishDeviceConfigUseCase } from "./republish-device-config";

const ENDPOINT = "data.iot.example.amazonaws.com";

describe("RepublishDeviceConfigUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: RepublishDeviceConfigUseCase;
  let repository: ExperimentDeviceRepository;
  let awsAdapter: AwsAdapter;
  let publishSpy: MockInstance<AwsAdapter["publishDeviceConfig"]>;
  let userId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    userId = await testApp.createTestUser({ name: "Owner" });
    useCase = testApp.module.get(RepublishDeviceConfigUseCase);
    repository = testApp.module.get(ExperimentDeviceRepository);
    awsAdapter = testApp.module.get(AwsAdapter);
    vi.spyOn(awsAdapter, "getIotDataEndpoint").mockResolvedValue(success(ENDPOINT));
    publishSpy = vi.spyOn(awsAdapter, "publishDeviceConfig").mockResolvedValue(success(undefined));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  const publishedConfig = (): DeviceOnboardingConfig => publishSpy.mock.calls[0][1];

  const pinQuestionWorkbook = async (experimentId: string, cellId: string) => {
    const workbook = await testApp.createWorkbook({ name: "QWB", createdBy: userId });
    const [version] = await testApp.database
      .insert(workbookVersions)
      .values({
        workbookId: workbook.id,
        version: 1,
        cells: [
          {
            id: cellId,
            type: "question",
            name: "plot",
            question: { kind: "open_ended", text: "Which plot?", required: true },
            isCollapsed: false,
          },
        ],
        metadata: {},
        entitySnapshots: { protocols: {}, macros: {} },
        createdBy: userId,
      })
      .returning();
    await testApp.database
      .update(experiments)
      .set({ workbookId: workbook.id, workbookVersionId: version.id })
      .where(eq(experiments.id, experimentId));
  };

  it("publishes the full state with stored answers resolved and an issuedAt stamp", async () => {
    const device = await testApp.createIotDevice({ createdBy: userId, status: "active" });
    const { experiment } = await testApp.createExperiment({ name: "Live", userId });
    const cellId = faker.string.uuid();
    await pinQuestionWorkbook(experiment.id, cellId);
    await repository.addExperiments(device.id, [experiment.id], userId);
    await repository.mergePlanAnswers(device.id, experiment.id, { [cellId]: "A1" });

    const result = await useCase.execute(device.id);

    assertSuccess(result);
    expect(publishSpy).toHaveBeenCalledWith(device.thingName, expect.anything());
    const config = publishedConfig();
    expect(config.endpoint).toBe(ENDPOINT);
    expect(config.issuedAt).toEqual(expect.any(String));
    expect(config.experiments).toHaveLength(1);
    const question = config.experiments[0].procedures.find(
      (procedure) => procedure.type === "question",
    );
    expect(question?.answer).toBe("A1");
  });

  it("drops archived experiments from the retained state", async () => {
    const device = await testApp.createIotDevice({ createdBy: userId, status: "active" });
    const { experiment: live } = await testApp.createExperiment({ name: "Live", userId });
    const { experiment: archived } = await testApp.createExperiment({ name: "Old", userId });
    await testApp.database
      .update(experiments)
      .set({ status: "archived" })
      .where(eq(experiments.id, archived.id));
    await repository.addExperiments(device.id, [live.id, archived.id], userId);

    const result = await useCase.execute(device.id);

    assertSuccess(result);
    const config = publishedConfig();
    expect(config.experiments.map((experiment) => experiment.experimentId)).toEqual([live.id]);
  });

  it("is a silent no-op for phones and for devices already gone", async () => {
    const phone = await testApp.createIotDevice({ createdBy: userId, deviceType: "mobile" });

    assertSuccess(await useCase.execute(phone.id));
    assertSuccess(await useCase.execute(faker.string.uuid()));
    expect(publishSpy).not.toHaveBeenCalled();
  });

  it("propagates an endpoint failure", async () => {
    vi.spyOn(awsAdapter, "getIotDataEndpoint").mockResolvedValue(
      failure(AppError.internal("endpoint unavailable")),
    );
    const device = await testApp.createIotDevice({ createdBy: userId, status: "active" });

    const result = await useCase.execute(device.id);

    assertFailure(result);
  });
});
