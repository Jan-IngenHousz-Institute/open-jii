import { Logger } from "@nestjs/common";
import type { MockInstance } from "vitest";

import { eq, iotDevices } from "@repo/database";

import { AuthorizationService } from "../../../authorization/authorization.service";
import { AppError, assertSuccess, failure } from "../../../common/utils/fp-utils";
import { NotificationDispatchService } from "../../../notifications/application/services/notification-dispatch.service";
import { SharingRepository } from "../../../sharing/core/repositories/sharing.repository";
import {
  calibrationDeliveries,
  calibrationNotifications,
  heardBy,
  seedCalibrationAudience,
} from "../../../test/calibration-audience";
import type { CalibrationAudience } from "../../../test/calibration-audience";
import { TestHarness } from "../../../test/test-harness";
import { IotCalibrationDefinitionRepository } from "../../core/repositories/iot-calibration-definition.repository";
import { IotCalibrationRunRepository } from "../../core/repositories/iot-calibration-run.repository";
import { CalibrationRunNotifier } from "./calibration-run-notifier";

describe("CalibrationRunNotifier", () => {
  const testApp = TestHarness.App;
  let notifier: CalibrationRunNotifier;
  let runRepository: IotCalibrationRunRepository;
  let audience: CalibrationAudience;
  let run: { id: string; deviceId: string; definitionId: string; requestedBy: string };
  let error: MockInstance;
  let requesterGrantId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    notifier = testApp.module.get(CalibrationRunNotifier);
    runRepository = testApp.module.get(IotCalibrationRunRepository);
    audience = await seedCalibrationAudience(testApp);
    // Only someone who can work on the device starts a run, so the requester holds Can edit.
    const grant = await testApp.addResourceGrant({
      resourceType: "device",
      resourceId: audience.deviceId,
      granteeType: "user",
      granteeId: audience.requester,
      role: "admin",
    });
    requesterGrantId = grant.id;

    const definition = await testApp.module.get(IotCalibrationDefinitionRepository).create(
      {
        family: "minipar",
        name: "PAR sweep",
        description: null,
        captureProcedure: {
          instruments: [{ role: "dut" }],
          steps: [
            {
              kind: "read",
              series: "par_sweep",
              read: [{ instrument: "dut", command: "get_par", as: "par_raw" }],
            },
          ],
        },
        script: "submit({})",
        outputSchema: { blocks: { par: { spec: { type: "number" } } } },
        minFirmwareVersion: null,
      },
      audience.owner,
    );
    assertSuccess(definition);

    const created = await runRepository.create({
      definitionId: definition.value[0].id,
      deviceId: audience.deviceId,
      requestedBy: audience.requester,
      inputSource: "external_bench",
      status: "computed",
      blocks: { par: { status: "computed", coefficients: { spec: 1.19 } } },
    });
    assertSuccess(created);
    run = created.value;

    error = vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  const row = (type: string, actorId: string) => (recipientId: string) => ({
    type,
    recipientId,
    actorId,
    resourceType: "device",
    resourceId: audience.deviceId,
    params: { deviceName: "Test device", definitionName: "PAR sweep" },
  });

  const loggedFor = (msg: string, runId = run.id): unknown =>
    expect.objectContaining({
      msg: expect.stringContaining(msg) as string,
      operation: "testOperation",
      runId,
      deviceId: audience.deviceId,
    });

  const nobodyHeard = async (dispatch: MockInstance) => {
    expect(dispatch).not.toHaveBeenCalled();
    expect(await calibrationNotifications(testApp, audience)).toEqual(
      heardBy(audience, [], () => null),
    );
  };

  const spyOnDispatch = () => vi.spyOn(testApp.module.get(NotificationDispatchService), "dispatch");

  it("tells the owner and the device's managers that a run is waiting", async () => {
    await notifier.runAwaitingApproval("testOperation", run);

    expect(await calibrationNotifications(testApp, audience)).toEqual(
      heardBy(
        audience,
        ["owner", "manager"],
        row("calibration_run_awaiting_approval", audience.requester),
      ),
    );
    expect(error).not.toHaveBeenCalled();
  });

  it.each(["approved", "rejected"] as const)(
    "tells the requester the run was %s",
    async (decision) => {
      await notifier.runReviewed("testOperation", decision, run, audience.manager);

      expect(await calibrationNotifications(testApp, audience)).toEqual(
        heardBy(audience, ["requester"], row(`calibration_run_${decision}`, audience.manager)),
      );
      expect(error).not.toHaveBeenCalled();
    },
  );

  describe.each([
    ["runAwaitingApproval", (r: typeof run) => notifier.runAwaitingApproval("testOperation", r)],
    [
      "runReviewed",
      (r: typeof run) => notifier.runReviewed("testOperation", "approved", r, audience.manager),
    ],
  ] as const)("%s", (_, notify) => {
    it("notifies nobody and logs when the names cannot be read", async () => {
      vi.spyOn(runRepository, "findRunLabels").mockResolvedValue(
        failure(AppError.internal("Database unavailable")),
      );

      const dispatch = spyOnDispatch();

      await notify(run);

      await nobodyHeard(dispatch);
      expect(error).toHaveBeenCalledExactlyOnceWith(
        loggedFor("Could not name the run's device and definition"),
      );
    });

    it("notifies nobody and logs when the run does not exist", async () => {
      const missing = { ...run, id: crypto.randomUUID() };

      const dispatch = spyOnDispatch();

      await notify(missing);

      await nobodyHeard(dispatch);
      expect(error).toHaveBeenCalledExactlyOnceWith(
        loggedFor("Could not name the run's device and definition", missing.id),
      );
    });
  });

  it("notifies nobody and logs when the device's managers cannot be read", async () => {
    vi.spyOn(testApp.module.get(SharingRepository), "listAdminIds").mockResolvedValue(
      failure(AppError.internal("Database unavailable")),
    );

    const dispatch = spyOnDispatch();

    await notifier.runAwaitingApproval("testOperation", run);

    await nobodyHeard(dispatch);
    expect(error).toHaveBeenCalledExactlyOnceWith(
      loggedFor("Could not read who manages the device"),
    );
  });

  it("logs when the waiting run cannot be dispatched", async () => {
    vi.spyOn(testApp.module.get(NotificationDispatchService), "dispatch").mockResolvedValue(
      failure(AppError.internal("Database unavailable")),
    );

    await notifier.runAwaitingApproval("testOperation", run);

    expect(error).toHaveBeenCalledExactlyOnceWith(
      loggedFor("Failed to notify the device's managers, the run was still recorded"),
    );
  });

  it.each(["approved", "rejected"] as const)(
    "logs that the run was still %s when the decision cannot be dispatched",
    async (decision) => {
      vi.spyOn(testApp.module.get(NotificationDispatchService), "dispatch").mockResolvedValue(
        failure(AppError.internal("Database unavailable")),
      );

      await notifier.runReviewed("testOperation", decision, run, audience.manager);

      expect(error).toHaveBeenCalledExactlyOnceWith(
        loggedFor(`Failed to notify the requester, the run was still ${decision}`),
      );
    },
  );

  describe("a requester who can no longer read the device", () => {
    let info: MockInstance;

    beforeEach(() => {
      info = vi.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
    });

    const nobodyTold = async (dispatch: MockInstance) => {
      await nobodyHeard(dispatch);
      expect(await calibrationDeliveries(testApp, audience)).toEqual(
        heardBy(audience, [], () => null),
      );
      expect(info).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: "The requester can no longer read the device, the decision was not sent",
          operation: "testOperation",
          runId: run.id,
          deviceId: audience.deviceId,
          requesterId: audience.requester,
        }),
      );
      expect(error).not.toHaveBeenCalled();
    };

    it("is not told of an approval once their grant is removed", async () => {
      await testApp.removeResourceGrant(requesterGrantId);
      const dispatch = spyOnDispatch();

      await notifier.runReviewed("testOperation", "approved", run, audience.manager);

      await nobodyTold(dispatch);
    });

    it("is not told of a rejection once the device moved to an organization they are not in", async () => {
      await testApp.removeResourceGrant(requesterGrantId);
      await testApp.addOrganizationMember(audience.organizationId, audience.requester, "member");
      await testApp.database
        .update(iotDevices)
        .set({ organizationId: await testApp.createOrganization() })
        .where(eq(iotDevices.id, audience.deviceId));
      const dispatch = spyOnDispatch();

      await notifier.runReviewed("testOperation", "rejected", run, audience.manager);

      await nobodyTold(dispatch);
    });

    it("is not told, and the failure is logged, when the check cannot be made", async () => {
      vi.spyOn(testApp.module.get(AuthorizationService), "can").mockRejectedValue(
        new Error("connection terminated"),
      );
      const dispatch = spyOnDispatch();

      await notifier.runReviewed("testOperation", "approved", run, audience.manager);

      await nobodyHeard(dispatch);
      expect(error).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          msg: "Could not check the requester can still read the device, the decision was not sent",
          operation: "testOperation",
          runId: run.id,
          deviceId: audience.deviceId,
          requesterId: audience.requester,
        }),
      );
    });
  });
});
