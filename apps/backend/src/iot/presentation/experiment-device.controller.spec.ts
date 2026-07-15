import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api/contract";
import type {
  DeviceExperimentList,
  DeviceOnboardingConfig,
  ExperimentDeviceList,
} from "@repo/api/schemas/iot.schema";
import { eq, experiments } from "@repo/database";

import { AwsAdapter } from "../../common/modules/aws/aws.adapter";
import { success } from "../../common/utils/fp-utils";
import { TestHarness } from "../../test/test-harness";
import type { SuperTestResponse } from "../../test/test-harness";

const ENDPOINT = "abc123-ats.iot.eu-central-1.amazonaws.com";

describe("ExperimentDeviceController", () => {
  const testApp = TestHarness.App;
  let userId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    userId = await testApp.createTestUser({ name: "Owner" });
    const awsAdapter = testApp.module.get(AwsAdapter);
    vi.spyOn(awsAdapter, "getIotDataEndpoint").mockResolvedValue(success(ENDPOINT));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  const onboardPath = (deviceId: string) =>
    testApp.resolvePath(contract.iot.onboardDevice.path, { deviceId });

  it("onboards a device and returns its config (200)", async () => {
    const device = await testApp.createIotDevice({ createdBy: userId, status: "active" });
    const { experiment } = await testApp.createExperiment({ name: "Photosynthesis", userId });

    const response: SuperTestResponse<DeviceOnboardingConfig> = await testApp
      .post(onboardPath(device.id))
      .withAuth(userId)
      .send({ experimentIds: [experiment.id] })
      .expect(StatusCodes.OK);

    expect(response.body.thingName).toBe(device.thingName);
    expect(response.body.endpoint).toBe(ENDPOINT);
    expect(response.body.experiments).toHaveLength(1);
    expect(response.body.experiments[0].experimentName).toBe("Photosynthesis");
  });

  it("re-issues the config for an empty body (200)", async () => {
    const device = await testApp.createIotDevice({ createdBy: userId, status: "active" });
    const { experiment } = await testApp.createExperiment({ name: "E", userId });
    await testApp
      .post(onboardPath(device.id))
      .withAuth(userId)
      .send({ experimentIds: [experiment.id] })
      .expect(StatusCodes.OK);

    const response: SuperTestResponse<DeviceOnboardingConfig> = await testApp
      .post(onboardPath(device.id))
      .withAuth(userId)
      .send({})
      .expect(StatusCodes.OK);

    expect(response.body.experiments).toHaveLength(1);
  });

  it("lists the experiments a device serves (200)", async () => {
    const device = await testApp.createIotDevice({ createdBy: userId, status: "active" });
    const { experiment } = await testApp.createExperiment({ name: "Alpha", userId });
    await testApp
      .post(onboardPath(device.id))
      .withAuth(userId)
      .send({ experimentIds: [experiment.id] })
      .expect(StatusCodes.OK);

    const path = testApp.resolvePath(contract.iot.listDeviceExperiments.path, {
      deviceId: device.id,
    });
    const response: SuperTestResponse<DeviceExperimentList> = await testApp
      .get(path)
      .withAuth(userId)
      .expect(StatusCodes.OK);

    expect(response.body).toHaveLength(1);
    expect(response.body[0].name).toBe("Alpha");
    expect(response.body[0].addedAt).toEqual(expect.any(String));
  });

  it("lists and detaches a device on the experiment side", async () => {
    const device = await testApp.createIotDevice({ createdBy: userId, status: "active" });
    const { experiment } = await testApp.createExperiment({ name: "E", userId });
    await testApp
      .post(onboardPath(device.id))
      .withAuth(userId)
      .send({ experimentIds: [experiment.id] })
      .expect(StatusCodes.OK);

    const listPath = testApp.resolvePath(contract.experiments.listExperimentDevices.path, {
      id: experiment.id,
    });
    const listed: SuperTestResponse<ExperimentDeviceList> = await testApp
      .get(listPath)
      .withAuth(userId)
      .expect(StatusCodes.OK);
    expect(listed.body).toHaveLength(1);
    expect(listed.body[0].device.id).toBe(device.id);

    const removePath = testApp.resolvePath(contract.experiments.removeExperimentDevice.path, {
      id: experiment.id,
      deviceId: device.id,
    });
    await testApp.delete(removePath).withAuth(userId).expect(StatusCodes.NO_CONTENT);

    const after: SuperTestResponse<ExperimentDeviceList> = await testApp
      .get(listPath)
      .withAuth(userId)
      .expect(StatusCodes.OK);
    expect(after.body).toEqual([]);
  });

  it("detaches a device from a since-archived experiment (204)", async () => {
    const device = await testApp.createIotDevice({ createdBy: userId, status: "active" });
    const { experiment } = await testApp.createExperiment({ name: "E", userId });
    await testApp
      .post(onboardPath(device.id))
      .withAuth(userId)
      .send({ experimentIds: [experiment.id] })
      .expect(StatusCodes.OK);

    await testApp.database
      .update(experiments)
      .set({ status: "archived" })
      .where(eq(experiments.id, experiment.id));

    const removePath = testApp.resolvePath(contract.experiments.removeExperimentDevice.path, {
      id: experiment.id,
      deviceId: device.id,
    });
    await testApp.delete(removePath).withAuth(userId).expect(StatusCodes.NO_CONTENT);
  });

  it("returns 400 when onboarding a device without active credentials", async () => {
    const device = await testApp.createIotDevice({ createdBy: userId, status: "pending" });
    const { experiment } = await testApp.createExperiment({ name: "E", userId });

    await testApp
      .post(onboardPath(device.id))
      .withAuth(userId)
      .send({ experimentIds: [experiment.id] })
      .expect(StatusCodes.BAD_REQUEST);
  });

  it("returns 403 when onboarding to an experiment the caller is not a member of", async () => {
    const stranger = await testApp.createTestUser({});
    const { experiment } = await testApp.createExperiment({ name: "E", userId });
    const device = await testApp.createIotDevice({ createdBy: stranger, status: "active" });

    await testApp
      .post(onboardPath(device.id))
      .withAuth(stranger)
      .send({ experimentIds: [experiment.id] })
      .expect(StatusCodes.FORBIDDEN);
  });

  it("returns 400 for an invalid body", async () => {
    const device = await testApp.createIotDevice({ createdBy: userId, status: "active" });

    await testApp
      .post(onboardPath(device.id))
      .withAuth(userId)
      .send({ experimentIds: ["not-a-uuid"] })
      .expect(StatusCodes.BAD_REQUEST);
  });

  it("returns 401 when unauthenticated", async () => {
    const device = await testApp.createIotDevice({ createdBy: userId, status: "active" });

    await testApp.post(onboardPath(device.id)).send({}).expect(StatusCodes.UNAUTHORIZED);
  });
});
