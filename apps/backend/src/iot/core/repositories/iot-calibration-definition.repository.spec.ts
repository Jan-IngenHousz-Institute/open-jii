import { faker } from "@faker-js/faker";

import type { CaptureProcedure } from "@repo/api/domains/iot/calibration/iot-calibration-procedure.schema";

import { assertSuccess } from "../../../common/utils/fp-utils";
import { TestHarness } from "../../../test/test-harness";
import { IotCalibrationDefinitionRepository } from "./iot-calibration-definition.repository";

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

const OUTPUT_SCHEMA = {
  blocks: { par: { spec: { type: "number" as const, min: 0.05, max: 100.0 } } },
};

describe("IotCalibrationDefinitionRepository", () => {
  const testApp = TestHarness.App;
  let repository: IotCalibrationDefinitionRepository;
  let userId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    userId = await testApp.createTestUser({ name: "Calibration Author" });
    repository = testApp.module.get(IotCalibrationDefinitionRepository);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  const createDefinition = async (ownerId: string, name?: string) => {
    const created = await repository.create(
      {
        family: "minipar",
        name: name ?? `PAR calibration ${faker.string.uuid()}`,
        description: null,
        captureProcedure: PROCEDURE,
        script: "submit({})",
        outputSchema: OUTPUT_SCHEMA,
      },
      ownerId,
    );
    assertSuccess(created);
    return created.value[0];
  };

  it("creates version 1 and versions the same name by supersession", async () => {
    const v1 = await createDefinition(userId, "MiniPAR factory calibration");
    expect(v1.version).toBe(1);

    const v2 = await createDefinition(userId, "MiniPAR factory calibration");
    expect(v2.version).toBe(2);
    expect(v2.id).not.toBe(v1.id);

    const latest = await repository.findLatestByName("MiniPAR factory calibration");
    assertSuccess(latest);
    expect(latest.value?.version).toBe(2);
  });

  it("round-trips the procedure and output schema through jsonb", async () => {
    const definition = await createDefinition(userId);

    const found = await repository.findById(definition.id);
    assertSuccess(found);
    expect(found.value?.captureProcedure).toEqual(PROCEDURE);
    expect(found.value?.outputSchema).toEqual(OUTPUT_SCHEMA);
  });

  it("lists public definitions to strangers and filters by family", async () => {
    const definition = await createDefinition(userId);
    const stranger = await testApp.createTestUser({ name: "Stranger" });

    const visible = await repository.listAccessible(stranger, { family: "minipar" });
    assertSuccess(visible);
    expect(visible.value.map((row) => row.id)).toContain(definition.id);

    const otherFamily = await repository.listAccessible(stranger, { family: "ambit" });
    assertSuccess(otherFamily);
    expect(otherFamily.value.map((row) => row.id)).not.toContain(definition.id);
  });

  it("deletes a definition", async () => {
    const definition = await createDefinition(userId);

    const deleted = await repository.delete(definition.id);
    assertSuccess(deleted);

    const found = await repository.findById(definition.id);
    assertSuccess(found);
    expect(found.value).toBeNull();
  });
});
