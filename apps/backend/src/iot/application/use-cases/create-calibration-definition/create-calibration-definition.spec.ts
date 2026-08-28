import type { CaptureProcedure } from "@repo/api/domains/iot/calibration/iot-calibration-procedure.schema";

import { assertFailure, assertSuccess } from "../../../../common/utils/fp-utils";
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

  it("creates version 1 in the author's personal organization", async () => {
    const created = await useCase.execute(body(), userId);
    assertSuccess(created);
    expect(created.value.version).toBe(1);
    expect(created.value.organizationId).toBe(await testApp.personalOrganizationId(userId));
  });

  it("adds a version to a line the author owns", async () => {
    const first = await useCase.execute(body(), userId);
    assertSuccess(first);

    const second = await useCase.execute(body(), userId);
    assertSuccess(second);
    expect(second.value.version).toBe(2);
    expect(second.value.organizationId).toBe(first.value.organizationId);
  });

  it("refuses a version that would change the line's family", async () => {
    const first = await useCase.execute(body(), userId);
    assertSuccess(first);

    const wrongFamily = await useCase.execute(body({ family: "ambit" }), userId);
    assertFailure(wrongFamily);
    expect(wrongFamily.error.message).toContain("already exists for family");
  });

  /**
   * `@CanCreateInOrg` only vets an organizationId the body carries. A new
   * version inherits the line's owning organization, so without an explicit
   * check an outsider could plant a version inside another organization's line
   * and hold creator control over it.
   */
  it("refuses an outsider adding a version to another organization's line", async () => {
    const organizationId = await testApp.createOrganization("Photosynthesis Lab");
    await testApp.addOrganizationMember(organizationId, userId, "owner");

    const first = await useCase.execute(body({ organizationId }), userId);
    assertSuccess(first);
    expect(first.value.organizationId).toBe(organizationId);

    const outsider = await testApp.createTestUser({ name: "Otto Outsider" });
    const planted = await useCase.execute(body(), outsider);

    assertFailure(planted);
    expect(planted.error.statusCode).toBe(403);
  });

  it("refuses an outsider adding a version to a personally owned line", async () => {
    const first = await useCase.execute(body(), userId);
    assertSuccess(first);

    const outsider = await testApp.createTestUser({ name: "Otto Outsider" });
    const planted = await useCase.execute(body(), outsider);

    assertFailure(planted);
    expect(planted.error.statusCode).toBe(403);
  });

  it("lets a fellow organization member add a version", async () => {
    const organizationId = await testApp.createOrganization("Photosynthesis Lab");
    await testApp.addOrganizationMember(organizationId, userId, "owner");
    const colleague = await testApp.createTestUser({ name: "Mel Member" });
    await testApp.addOrganizationMember(organizationId, colleague, "member");

    const first = await useCase.execute(body({ organizationId }), userId);
    assertSuccess(first);

    const second = await useCase.execute(body(), colleague);
    assertSuccess(second);
    expect(second.value.version).toBe(2);
    expect(second.value.organizationId).toBe(organizationId);
  });
});
