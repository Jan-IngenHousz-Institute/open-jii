import type { CaptureProcedure } from "@repo/api/domains/iot/calibration/iot-calibration-procedure.schema";

import { assertFailure, assertSuccess } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { IotCalibrationDefinitionRepository } from "../../../core/repositories/iot-calibration-definition.repository";
import { IotCalibrationRunRepository } from "../../../core/repositories/iot-calibration-run.repository";
import { CreateCalibrationDefinitionUseCase } from "../create-calibration-definition/create-calibration-definition";
import { UpdateCalibrationDefinitionUseCase } from "./update-calibration-definition";

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

describe("UpdateCalibrationDefinitionUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: UpdateCalibrationDefinitionUseCase;
  let createUseCase: CreateCalibrationDefinitionUseCase;
  let runRepository: IotCalibrationRunRepository;
  let definitionRepository: IotCalibrationDefinitionRepository;
  let userId: string;
  let deviceId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    userId = await testApp.createTestUser({ name: "Calibration Author" });
    useCase = testApp.module.get(UpdateCalibrationDefinitionUseCase);
    createUseCase = testApp.module.get(CreateCalibrationDefinitionUseCase);
    runRepository = testApp.module.get(IotCalibrationRunRepository);
    definitionRepository = testApp.module.get(IotCalibrationDefinitionRepository);
    const device = await testApp.createIotDevice({ createdBy: userId, deviceType: "minipar" });
    deviceId = device.id;
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  const create = async (name = "PAR bench calibration") => {
    const created = await createUseCase.execute(
      {
        family: "minipar",
        name,
        captureProcedure: PROCEDURE,
        script: "submit({})",
        outputSchema: { blocks: { par: { spec: { type: "number" } } } },
      },
      userId,
    );
    assertSuccess(created);
    return created.value.id;
  };

  it("edits the artefacts the author changed and leaves the rest", async () => {
    const definitionId = await create();

    const updated = await useCase.execute(
      definitionId,
      { description: "Three light levels and darkness", script: "submit({'par': {}})" },
      userId,
    );

    assertSuccess(updated);
    expect(updated.value.description).toBe("Three light levels and darkness");
    expect(updated.value.script).toBe("submit({'par': {}})");
    expect(updated.value.name).toBe("PAR bench calibration");
  });

  // A run records the definition it ran, not a copy of it. Editing one that has been run
  // would change what those runs appear to have done; versioning is what fixes that, and
  // it is deferred.
  it("refuses to edit a definition that has already been run", async () => {
    const definitionId = await create();
    const run = await runRepository.create({
      definitionId,
      deviceId,
      requestedBy: userId,
      inputSource: "bench_wizard",
      status: "computed",
    });
    assertSuccess(run);

    const updated = await useCase.execute(definitionId, { script: "submit({})" }, userId);

    assertFailure(updated);
    expect(updated.error.message).toContain("cannot be edited");
  });

  it("allows a rename onto a name another definition holds", async () => {
    const definitionId = await create();
    await create("Spectral bench calibration");

    const updated = await useCase.execute(
      definitionId,
      { name: "Spectral bench calibration" },
      userId,
    );

    assertSuccess(updated);
    expect(updated.value.name).toBe("Spectral bench calibration");
  });

  it("lets a definition keep its own name", async () => {
    const definitionId = await create();

    const updated = await useCase.execute(
      definitionId,
      { name: "PAR bench calibration", description: "unchanged name" },
      userId,
    );

    assertSuccess(updated);
  });

  it("reports a definition that is not there", async () => {
    const updated = await useCase.execute(crypto.randomUUID(), { script: "submit({})" }, userId);

    assertFailure(updated);
    expect(updated.error.statusCode).toBe(404);
  });

  it("leaves the stored procedure parseable after an edit", async () => {
    const definitionId = await create();

    const updated = await useCase.execute(
      definitionId,
      {
        captureProcedure: {
          ...PROCEDURE,
          steps: [{ kind: "settle", ms: 500 }, ...PROCEDURE.steps],
        },
      },
      userId,
    );
    assertSuccess(updated);

    const reread = await definitionRepository.findById(definitionId);
    assertSuccess(reread);
    expect(reread.value?.captureProcedure.steps).toHaveLength(2);
  });
});
