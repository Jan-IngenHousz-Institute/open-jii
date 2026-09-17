import type { CaptureProcedure } from "@repo/api/domains/iot/calibration/iot-calibration-procedure.schema";

import { assertSuccess } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { IotCalibrationDefinitionRepository } from "../../../core/repositories/iot-calibration-definition.repository";
import { ListCalibrationDefinitionsUseCase } from "./list-calibration-definitions";

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

describe("ListCalibrationDefinitionsUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: ListCalibrationDefinitionsUseCase;
  let definitionRepository: IotCalibrationDefinitionRepository;
  let userId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    userId = await testApp.createTestUser({ name: "Calibration Author" });
    useCase = testApp.module.get(ListCalibrationDefinitionsUseCase);
    definitionRepository = testApp.module.get(IotCalibrationDefinitionRepository);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  const createDefinition = async (family: "minipar" | "ambit") => {
    const definition = await definitionRepository.create(
      {
        family,
        name: `${family} calibration ${crypto.randomUUID()}`,
        description: null,
        captureProcedure: PROCEDURE,
        script: "submit({})",
        outputSchema: { blocks: { par: { spec: { type: "number" } } } },
        minFirmwareVersion: null,
      },
      userId,
    );
    assertSuccess(definition);
    return definition.value[0].id;
  };

  it("lists the definitions a caller may read", async () => {
    const minipar = await createDefinition("minipar");

    const result = await useCase.execute(userId);
    assertSuccess(result);
    expect(result.value.map((row) => row.id)).toContain(minipar);
  });

  it("narrows to one device family", async () => {
    const minipar = await createDefinition("minipar");
    const ambit = await createDefinition("ambit");

    const result = await useCase.execute(userId, "ambit");
    assertSuccess(result);
    const ids = result.value.map((row) => row.id);
    expect(ids).toContain(ambit);
    expect(ids).not.toContain(minipar);
  });
});
