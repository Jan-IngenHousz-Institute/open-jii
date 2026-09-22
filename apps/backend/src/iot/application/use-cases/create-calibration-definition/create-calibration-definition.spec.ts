import type { CaptureProcedure } from "@repo/api/domains/iot/calibration/iot-calibration-procedure.schema";

import { assertSuccess } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { CreateCalibrationDefinitionUseCase } from "./create-calibration-definition";

const PROCEDURE: CaptureProcedure = {
  instruments: [{ role: "dut" }],
  steps: [
    {
      kind: "read",
      series: "par_sweep",
      read: [{ instrument: "dut", command: "get_par", as: "par_raw" }],
    },
  ],
};

const OUTPUT_SCHEMA = { blocks: { par: { spec: { type: "number" as const } } } };

describe("CreateCalibrationDefinitionUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: CreateCalibrationDefinitionUseCase;
  let userId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    userId = await testApp.createTestUser({ name: "Calibration Author" });
    useCase = testApp.module.get(CreateCalibrationDefinitionUseCase);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  const body = (overrides: Record<string, unknown> = {}) => ({
    family: "minipar" as const,
    name: "PAR bench calibration",
    captureProcedure: PROCEDURE,
    script: "submit({})",
    outputSchema: OUTPUT_SCHEMA,
    ...overrides,
  });

  it("creates a definition in the author's personal organization", async () => {
    const created = await useCase.execute(body(), userId);
    assertSuccess(created);
    expect(created.value.organizationId).toBe(await testApp.personalOrganizationId(userId));
  });

  // Older firmware answers unknown commands with numbers that look like readings, so a
  // definition that names a floor must keep it: dropping it leaves the gate open forever.
  it("keeps the firmware floor the caller declared", async () => {
    const created = await useCase.execute(body({ minFirmwareVersion: "1.05" }), userId);
    assertSuccess(created);
    expect(created.value.minFirmwareVersion).toBe("1.05");
  });

  // A name is a label, not a key, exactly as it is for a protocol or a workbook.
  it("accepts a name that is already taken", async () => {
    const first = await useCase.execute(body(), userId);
    assertSuccess(first);

    const second = await useCase.execute(body(), userId);
    assertSuccess(second);
    expect(second.value.id).not.toBe(first.value.id);
  });

  it("accepts a name another author took, whatever the family", async () => {
    const first = await useCase.execute(body(), userId);
    assertSuccess(first);

    const outsider = await testApp.createTestUser({ name: "Otto Outsider" });
    const alongside = await useCase.execute(body({ family: "ambit" }), outsider);

    assertSuccess(alongside);
    expect(alongside.value.id).not.toBe(first.value.id);
  });

  it("creates in an organization the author belongs to", async () => {
    const organizationId = await testApp.createOrganization("Photosynthesis Lab");
    await testApp.addOrganizationMember(organizationId, userId, "owner");

    const created = await useCase.execute(body({ organizationId }), userId);

    assertSuccess(created);
    expect(created.value.organizationId).toBe(organizationId);
  });
});
