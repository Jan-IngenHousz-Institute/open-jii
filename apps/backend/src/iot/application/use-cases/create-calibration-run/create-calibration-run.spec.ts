import type { CaptureProcedure } from "@repo/api/domains/iot/calibration/iot-calibration-procedure.schema";
import { calibrationDefinitions, eq } from "@repo/database";

import { AuthorizationService } from "../../../../authorization/authorization.service";
import {
  AppError,
  assertFailure,
  assertSuccess,
  failure,
  success,
} from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import type { CalibrationSandboxPort } from "../../../core/ports/calibration-sandbox.port";
import { IotCalibrationDefinitionRepository } from "../../../core/repositories/iot-calibration-definition.repository";
import { IotCalibrationRunRepository } from "../../../core/repositories/iot-calibration-run.repository";
import { IotDeviceRepository } from "../../../core/repositories/iot-device.repository";
import { CreateCalibrationRunUseCase } from "./create-calibration-run";

// The Ambit shape in miniature: one required sweep, one optional one.
const PROCEDURE: CaptureProcedure = {
  instruments: [{ role: "dut" }],
  steps: [
    {
      kind: "read",
      series: "par_sweep",
      read: [{ instrument: "dut", command: "get_par", as: "par_raw" }],
    },
    {
      kind: "read",
      series: "led_sweep",
      optional: true,
      read: [{ instrument: "dut", command: "get_par", as: "par_over_led" }],
    },
  ],
};

const OUTPUT_SCHEMA = {
  blocks: {
    par: { spec: { type: "number" as const } },
    led: { act: { type: "number" as const } },
  },
};

const PAYLOAD = { par_sweep: [{ par_raw: 148.2 }] };

describe("CreateCalibrationRunUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: CreateCalibrationRunUseCase;
  let definitionRepository: IotCalibrationDefinitionRepository;
  let userId: string;
  let deviceId: string;
  let definitionId: string;

  // The sandbox is an AWS boundary; what this use case owns is the event it
  // sends and how it maps what comes back onto the run.
  let sandboxResult: Awaited<ReturnType<CalibrationSandboxPort["invokeCalibrationSandbox"]>>;
  let sentEvent: { series?: unknown; params?: unknown } | null;

  const makeUseCase = () =>
    new CreateCalibrationRunUseCase(
      definitionRepository,
      testApp.module.get(IotCalibrationRunRepository),
      testApp.module.get(IotDeviceRepository),
      testApp.module.get(AuthorizationService),
      {
        invokeCalibrationSandbox: (payload: object) => {
          sentEvent = payload;
          return Promise.resolve(sandboxResult);
        },
      },
    );

  const createDefinition = async (overrides: Record<string, unknown> = {}) => {
    const definition = await definitionRepository.create(
      {
        family: "minipar",
        name: `PAR calibration ${crypto.randomUUID()}`,
        description: null,
        captureProcedure: PROCEDURE,
        script: "submit({})",
        outputSchema: OUTPUT_SCHEMA,
        minFirmwareVersion: null,
        ...overrides,
      },
      userId,
    );
    assertSuccess(definition);
    return definition.value[0].id;
  };

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    userId = await testApp.createTestUser({ name: "Calibration Operator" });
    definitionRepository = testApp.module.get(IotCalibrationDefinitionRepository);

    const device = await testApp.createIotDevice({ createdBy: userId, deviceType: "minipar" });
    deviceId = device.id;

    sentEvent = null;
    sandboxResult = success({
      statusCode: 200,
      payload: {
        status: "computed",
        blocks: { par: { status: "computed", coefficients: { spec: 1.19 } } },
      },
    });
    useCase = makeUseCase();
    definitionId = await createDefinition();
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  const run = (overrides: Record<string, unknown> = {}) =>
    useCase.execute({ deviceId, definitionId, payload: PAYLOAD, ...overrides }, userId);

  it("records a computed run and forwards the operator's params", async () => {
    const result = await run({ params: { lamp_serial: "K-42" } });

    assertSuccess(result);
    expect(result.value.status).toBe("computed");
    expect(result.value.blocks?.par.status).toBe("computed");
    expect(sentEvent?.params).toEqual({ lamp_serial: "K-42" });
  });

  it("accepts a payload missing only optional series", async () => {
    const result = await run();
    assertSuccess(result);
    expect(sentEvent?.series).toEqual(PAYLOAD);
  });

  it("refuses a payload missing a required series", async () => {
    const result = await run({ payload: { led_sweep: [{ par_over_led: 1 }] } });
    assertFailure(result);
    expect(result.error.message).toContain("missing required series");
  });

  it("refuses a payload carrying series the procedure cannot produce", async () => {
    const result = await run({ payload: { ...PAYLOAD, stray: [{ x: 1 }] } });
    assertFailure(result);
    expect(result.error.message).toContain("does not produce");
  });

  // The route guard authorizes the device, not the definition named in the body,
  // so an unreadable definition must be refused by the use case itself.
  it("refuses to run a definition the caller cannot read", async () => {
    await testApp.database
      .update(calibrationDefinitions)
      .set({ visibility: "private" })
      .where(eq(calibrationDefinitions.id, definitionId));
    const outsider = await testApp.createTestUser({ name: "Otto Outsider" });

    const result = await useCase.execute({ deviceId, definitionId, payload: PAYLOAD }, outsider);

    assertFailure(result);
    expect(result.error.statusCode).toBe(403);
    expect(sentEvent).toBeNull();
  });

  it("runs a public definition for someone outside its organization", async () => {
    const outsider = await testApp.createTestUser({ name: "Vera Visitor" });

    const result = await useCase.execute({ deviceId, definitionId, payload: PAYLOAD }, outsider);

    assertSuccess(result);
    expect(result.value.status).toBe("computed");
  });

  it("reports a missing definition or device as not found", async () => {
    const noDefinition = await run({ definitionId: crypto.randomUUID() });
    assertFailure(noDefinition);
    expect(noDefinition.error.statusCode).toBe(404);

    const noDevice = await run({ deviceId: crypto.randomUUID() });
    assertFailure(noDevice);
    expect(noDevice.error.statusCode).toBe(404);
  });

  it("refuses a device whose family the definition does not target", async () => {
    const ambit = await testApp.createIotDevice({ createdBy: userId, deviceType: "ambit" });
    const result = await run({ deviceId: ambit.id });
    assertFailure(result);
    expect(result.error.message).toContain("but the device is a");
  });

  it("records a script failure on the run rather than throwing it away", async () => {
    sandboxResult = success({
      statusCode: 200,
      payload: {
        status: "compute_failed",
        error: "Submitted blocks failed validation",
        reasons: ["Coefficient 'par.spec' is above the allowed maximum"],
      },
    });

    const result = await run();
    assertSuccess(result);
    expect(result.value.status).toBe("compute_failed");
    expect(result.value.errorMessage).toContain("above the allowed maximum");
  });

  it("fails a run where every block was rejected or skipped", async () => {
    sandboxResult = success({
      statusCode: 200,
      payload: {
        status: "computed",
        blocks: {
          par: { status: "rejected", reason: "R-squared below 0.99" },
          led: { status: "skipped", reason: "no reference connected" },
        },
      },
    });

    const result = await run();
    assertSuccess(result);
    expect(result.value.status).toBe("compute_failed");
    expect(result.value.errorMessage).toContain("No block produced coefficients");
    // The outcomes are kept: a reviewer needs to see why nothing computed.
    expect(result.value.blocks?.par.status).toBe("rejected");
  });

  it("records an unrecognized sandbox payload as an infrastructure error", async () => {
    sandboxResult = success({ statusCode: 200, payload: { unexpected: true } });

    const result = await run();
    assertSuccess(result);
    expect(result.value.status).toBe("error");
  });

  it("records an invoke failure as an infrastructure error", async () => {
    sandboxResult = failure(AppError.internal("Calibration sandbox Lambda is not configured"));

    const result = await run();
    assertSuccess(result);
    expect(result.value.status).toBe("error");
    expect(result.value.errorMessage).toContain("not configured");
  });

  describe("firmware gate", () => {
    it("refuses a device below the definition's minimum", async () => {
      const gated = await createDefinition({ minFirmwareVersion: "1.1.3" });
      const result = await run({ definitionId: gated, firmwareVersion: "1.1.2" });
      assertFailure(result);
      expect(result.error.message).toContain("requires firmware 1.1.3");
    });

    it("refuses a device that reports no version at all", async () => {
      const gated = await createDefinition({ minFirmwareVersion: "1.1.3" });
      const result = await run({ definitionId: gated });
      assertFailure(result);
      expect(result.error.message).toContain("did not report a version");
    });

    it("admits a device at or above the minimum", async () => {
      const gated = await createDefinition({ minFirmwareVersion: "1.1.3" });
      const result = await run({ definitionId: gated, firmwareVersion: "1.2.0" });
      assertSuccess(result);
    });
  });
});
