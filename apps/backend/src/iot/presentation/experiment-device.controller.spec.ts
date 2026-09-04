import { StatusCodes } from "http-status-codes";

import { FEATURE_FLAGS } from "@repo/analytics";
import { contract } from "@repo/api/contract";
import type { ExperimentDevicesOverview } from "@repo/api/domains/experiment/devices/experiment-devices.schema";
import type {
  DeviceExperimentList,
  DeviceOnboardingConfig,
} from "@repo/api/domains/iot/iot.schema";
import { eq, experiments } from "@repo/database";

import { AnalyticsAdapter } from "../../common/modules/analytics/analytics.adapter";
import { AwsAdapter } from "../../common/modules/aws/aws.adapter";
import { DatabricksAdapter } from "../../common/modules/databricks/databricks.adapter";
import { success } from "../../common/utils/fp-utils";
import type { MockAnalyticsAdapter } from "../../test/mocks/adapters/analytics.adapter.mock";
import { TestHarness } from "../../test/test-harness";
import type { SuperTestResponse } from "../../test/test-harness";

const ENDPOINT = "abc123-ats.iot.eu-central-1.amazonaws.com";

describe("ExperimentDeviceController", () => {
  const testApp = TestHarness.App;
  let userId: string;
  let analyticsAdapter: MockAnalyticsAdapter;

  beforeAll(async () => {
    await testApp.setup({ mock: { AnalyticsAdapter: true } });
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    userId = await testApp.createTestUser({ name: "Owner" });
    analyticsAdapter = testApp.module.get(AnalyticsAdapter);
    analyticsAdapter.setFlag(FEATURE_FLAGS.IOT_DEVICES, true);
    const awsAdapter = testApp.module.get(AwsAdapter);
    vi.spyOn(awsAdapter, "getIotDataEndpoint").mockResolvedValue(success(ENDPOINT));
    // The list is an orchestrated read; keep its enrichments quiet and offline here.
    vi.spyOn(awsAdapter, "searchThingsConnectivity").mockResolvedValue(success(new Map()));
    const databricksAdapter = testApp.module.get(DatabricksAdapter);
    vi.spyOn(databricksAdapter, "getExperimentPublishers").mockResolvedValue(success([]));
    vi.spyOn(databricksAdapter, "getDevicesLastActivity").mockResolvedValue(success(new Map()));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  const onboardPath = (deviceId: string) =>
    testApp.resolveOrpcPath(contract.iot.onboardDevice, { deviceId });

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
    expect(response.body.experiments[0].topicPrefix).toBe(
      `experiment/data_ingest/v1/${experiment.id}/${device.deviceType}`,
    );
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

    const path = testApp.resolveOrpcPath(contract.iot.listDeviceExperiments, {
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

    const listPath = testApp.resolveOrpcPath(contract.experiments.listExperimentDevices, {
      id: experiment.id,
    });
    const listed: SuperTestResponse<ExperimentDevicesOverview> = await testApp
      .get(listPath)
      .withAuth(userId)
      .expect(StatusCodes.OK);
    expect(listed.body.devices).toHaveLength(1);
    expect(listed.body.devices[0].device?.id).toBe(device.id);

    const removePath = testApp.resolveOrpcPath(contract.experiments.removeExperimentDevice, {
      id: experiment.id,
      deviceId: device.id,
    });
    await testApp.delete(removePath).withAuth(userId).expect(StatusCodes.NO_CONTENT);

    const after: SuperTestResponse<ExperimentDevicesOverview> = await testApp
      .get(listPath)
      .withAuth(userId)
      .expect(StatusCodes.OK);
    expect(after.body.devices).toEqual([]);
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

    const removePath = testApp.resolveOrpcPath(contract.experiments.removeExperimentDevice, {
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

  it("returns 403 when onboarding another user's device (no grant)", async () => {
    const stranger = await testApp.createTestUser({});
    const device = await testApp.createIotDevice({ createdBy: stranger, status: "active" });

    await testApp
      .post(onboardPath(device.id))
      .withAuth(userId)
      .send({})
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

  it("lets an org admin onboard an org device to an org experiment they are not a member of", async () => {
    const orgAdmin = await testApp.createTestUser({ name: "Org Admin" });
    const device = await testApp.createIotDevice({ createdBy: userId, status: "active" });
    const { experiment } = await testApp.createExperiment({ name: "Org experiment", userId });
    await testApp.addOrganizationMember(device.organizationId, orgAdmin, "admin");

    const response: SuperTestResponse<DeviceOnboardingConfig> = await testApp
      .post(onboardPath(device.id))
      .withAuth(orgAdmin)
      .send({ experimentIds: [experiment.id] })
      .expect(StatusCodes.OK);

    expect(response.body.experiments).toHaveLength(1);
  });

  it("refuses to re-issue a config that would omit inaccessible bindings (403)", async () => {
    const grantee = await testApp.createTestUser({ name: "Device grantee" });
    const device = await testApp.createIotDevice({ createdBy: userId, status: "active" });
    const { experiment } = await testApp.createExperiment({ name: "Private", userId });
    await testApp
      .post(onboardPath(device.id))
      .withAuth(userId)
      .send({ experimentIds: [experiment.id] })
      .expect(StatusCodes.OK);

    await testApp.addResourceGrant({
      resourceType: "device",
      resourceId: device.id,
      granteeType: "user",
      granteeId: grantee,
      role: "admin",
    });

    await testApp
      .post(onboardPath(device.id))
      .withAuth(grantee)
      .send({})
      .expect(StatusCodes.FORBIDDEN);
  });

  it("hides experiments the caller cannot read from a device's experiment list", async () => {
    const device = await testApp.createIotDevice({ createdBy: userId, status: "active" });
    const { experiment } = await testApp.createExperiment({ name: "Private", userId });
    await testApp
      .post(onboardPath(device.id))
      .withAuth(userId)
      .send({ experimentIds: [experiment.id] })
      .expect(StatusCodes.OK);

    // A device viewer grant passes the read guard but conveys nothing about
    // the experiments the device serves: the private binding stays invisible.
    const viewer = await testApp.createTestUser({ name: "Grant viewer" });
    await testApp.addResourceGrant({
      resourceType: "device",
      resourceId: device.id,
      granteeType: "user",
      granteeId: viewer,
      role: "viewer",
    });

    const path = testApp.resolveOrpcPath(contract.iot.listDeviceExperiments, {
      deviceId: device.id,
    });
    const response: SuperTestResponse<DeviceExperimentList> = await testApp
      .get(path)
      .withAuth(viewer)
      .expect(StatusCodes.OK);

    expect(response.body).toEqual([]);
  });

  it("lets an org admin view and detach devices on an org experiment they are not a member of", async () => {
    const orgAdmin = await testApp.createTestUser({ name: "Org Admin" });
    const device = await testApp.createIotDevice({ createdBy: userId, status: "active" });
    const { experiment } = await testApp.createExperiment({ name: "E", userId });
    await testApp
      .post(onboardPath(device.id))
      .withAuth(userId)
      .send({ experimentIds: [experiment.id] })
      .expect(StatusCodes.OK);
    await testApp.addOrganizationMember(experiment.organizationId, orgAdmin, "admin");

    const listPath = testApp.resolveOrpcPath(contract.experiments.listExperimentDevices, {
      id: experiment.id,
    });
    const listed: SuperTestResponse<ExperimentDevicesOverview> = await testApp
      .get(listPath)
      .withAuth(orgAdmin)
      .expect(StatusCodes.OK);
    expect(listed.body.devices).toHaveLength(1);

    const removePath = testApp.resolveOrpcPath(contract.experiments.removeExperimentDevice, {
      id: experiment.id,
      deviceId: device.id,
    });
    await testApp.delete(removePath).withAuth(orgAdmin).expect(StatusCodes.NO_CONTENT);
  });

  it("returns 403 on every endpoint when the iot-devices flag is disabled", async () => {
    const device = await testApp.createIotDevice({ createdBy: userId, status: "active" });
    const { experiment } = await testApp.createExperiment({ name: "E", userId });
    analyticsAdapter.setFlag(FEATURE_FLAGS.IOT_DEVICES, false);

    await testApp
      .post(onboardPath(device.id))
      .withAuth(userId)
      .send({})
      .expect(StatusCodes.FORBIDDEN);
    await testApp
      .get(testApp.resolveOrpcPath(contract.iot.listDeviceExperiments, { deviceId: device.id }))
      .withAuth(userId)
      .expect(StatusCodes.FORBIDDEN);
    await testApp
      .get(
        testApp.resolveOrpcPath(contract.experiments.listExperimentDevices, { id: experiment.id }),
      )
      .withAuth(userId)
      .expect(StatusCodes.FORBIDDEN);
    await testApp
      .delete(
        testApp.resolveOrpcPath(contract.experiments.removeExperimentDevice, {
          id: experiment.id,
          deviceId: device.id,
        }),
      )
      .withAuth(userId)
      .expect(StatusCodes.FORBIDDEN);
  });
});
