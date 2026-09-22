import type { CaptureProcedure } from "@repo/api/domains/iot/calibration/iot-calibration-procedure.schema";
import { calibrationDefinitions, eq } from "@repo/database";

import {
  AppError,
  assertFailure,
  assertSuccess,
  failure,
  success,
} from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { AWS_PORT } from "../../../core/ports/aws.port";
import type { AwsPort } from "../../../core/ports/aws.port";
import { IotCalibrationDefinitionRepository } from "../../../core/repositories/iot-calibration-definition.repository";
import { CreateCalibrationRunUseCase } from "./create-calibration-run";

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
  let awsPort: AwsPort;
  let sandboxResult: Awaited<ReturnType<AwsPort["invokeLambda"]>>;
  let sentEvent: { series?: unknown; params?: unknown } | null;

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
    awsPort = testApp.module.get(AWS_PORT);

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
    vi.spyOn(awsPort, "getCalibrationSandboxFunctionName").mockReturnValue("test-calibration");
    vi.spyOn(awsPort, "invokeLambda").mockImplementation((_functionName, payload) => {
      sentEvent = payload;
      return Promise.resolve(sandboxResult);
    });
    useCase = testApp.module.get(CreateCalibrationRunUseCase);

    definitionId = await createDefinition();
  });

  afterEach(() => {
    vi.restoreAllMocks();
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

  // A reading the operator took again travels beside its series so the discarded attempt
  // stays on the record. No procedure declares it, and refusing it would throw away the
  // whole session over the one point the operator corrected.
  it("accepts the retaken companion of a series the procedure declares", async () => {
    const result = await run({
      payload: { ...PAYLOAD, par_sweep_retaken: [{ par_raw: 1 }] },
    });
    assertSuccess(result);
  });

  // The same names become payload keys, dict keys and DataFrame columns, which only holds
  // if a row cannot arrive with a column its step never declared.
  it("refuses a row carrying a column the step does not record", async () => {
    const result = await run({ payload: { par_sweep: [{ par_raw: 148.2, temp: 21 }] } });
    assertFailure(result);
    expect(result.error.message).toContain("does not record: temp");
  });

  // The fit never sees a reading the operator took again; it stays on the record only.
  it("keeps retaken readings out of what the sandbox is sent", async () => {
    const payload = {
      par_sweep: [{ par_raw: 148.2 }],
      par_sweep_retaken: [{ par_raw: 12.0 }],
    };

    const result = await run({ payload });

    assertSuccess(result);
    expect(sentEvent?.series).toEqual({ par_sweep: [{ par_raw: 148.2 }] });
    expect(result.value.payload).toEqual(payload);
  });

  it("records the optional steps the bench skipped", async () => {
    const skippedSeries = [
      { series: "led_sweep", reason: 'instrument "emit_ref" is not connected' },
    ];

    const result = await run({ skippedSeries });

    assertSuccess(result);
    expect(result.value.skippedSeries).toEqual(skippedSeries);
  });

  // A definition with runs cannot be edited, so this record is the only place the
  // failing line ever appears to the script's author.
  it("keeps the script's traceback with a failed run", async () => {
    sandboxResult = success({
      statusCode: 200,
      payload: {
        status: "compute_failed",
        error: "KeyError: 'par_ref'",
        traceback: ['  File "<calibration-script>", line 3, in <module>', "KeyError: 'par_ref'"],
      },
    });

    const result = await run();

    assertSuccess(result);
    expect(result.value.status).toBe("compute_failed");
    expect(result.value.errorMessage).toContain("line 3");
  });

  describe("device identity", () => {
    let namedDeviceId: string;

    beforeEach(async () => {
      const device = await testApp.createIotDevice({
        createdBy: userId,
        deviceType: "minipar",
        serialNumber: "A4:CF:12:AA:93:B0",
      });
      namedDeviceId = device.id;
    });

    // Two units of one family on a bench: a session on the other one is refused, not
    // recorded against this device and later written to whichever is on the port.
    it("refuses a session on a unit other than this device", async () => {
      const result = await run({ deviceId: namedDeviceId, reportedSerial: "a4cf12aa93b1" });

      assertFailure(result);
      expect(result.error.message).toContain("reports serial");
    });

    it("accepts the unit's own identifier however its separators were written", async () => {
      const result = await run({ deviceId: namedDeviceId, reportedSerial: "a4cf12aa93b0" });

      assertSuccess(result);
    });
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

    // Firmware in the field carries release suffixes. Such a version used to be dropped
    // before it was ever sent, and the gate then refused the run for reporting nothing.
    it("admits a version that carries a release suffix", async () => {
      const gated = await createDefinition({ minFirmwareVersion: "1.1.3" });
      const result = await run({ definitionId: gated, firmwareVersion: "1.2.0-rc1" });
      assertSuccess(result);
    });
  });
});
