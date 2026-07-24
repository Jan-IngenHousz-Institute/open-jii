import { Logger } from "@nestjs/common";
import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api/contract";
import { OPENJII_CAPABILITIES_HEADER } from "@repo/api/domains/workbook/capabilities";

import { assertFailure, assertSuccess } from "../../common/utils/fp-utils";
import { TestHarness } from "../../test/test-harness";
import { PublishVersionUseCase } from "../application/use-cases/publish-version/publish-version";

/**
 * Ticket 7 cross-host qualification, server boundary. Unlike the controller
 * suites, nothing is mocked here: a real dynamic workbook version is published
 * into the database and fetched back over HTTP, proving the direct-API publish
 * gates and the capability refusal end to end.
 */
describe("dynamic command qualification (server boundary, no mocks)", () => {
  const testApp = TestHarness.App;
  let userId: string;
  let publishUseCase: PublishVersionUseCase;

  const dynamicCells = [
    {
      id: "m1",
      type: "macro",
      isCollapsed: false,
      payload: { macroId: "22222222-2222-2222-2222-222222222222", language: "python" },
    },
    {
      id: "c1",
      type: "command",
      isCollapsed: false,
      payload: { kind: "ref", ref: { sourceCellId: "m1", field: "toDevice" } },
    },
  ];

  beforeAll(async () => {
    await testApp.setup({ mock: { AnalyticsAdapter: true } });
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    userId = await testApp.createTestUser({});
    publishUseCase = testApp.module.get(PublishVersionUseCase);
  });

  afterEach(() => {
    testApp.afterEach();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  async function publishDynamicVersion() {
    vi.stubEnv("DYNAMIC_COMMAND_PUBLISH_ENABLED", "true");
    const workbook = await testApp.createWorkbook({
      name: "Dynamic qualification WB",
      cells: dynamicCells,
      createdBy: userId,
    });
    const published = await publishUseCase.execute(workbook.id, userId);
    assertSuccess(published);
    vi.unstubAllEnvs();
    return { workbook, version: published.value };
  }

  it("keeps all publication gates off by default in this environment", async () => {
    expect(process.env.DYNAMIC_COMMAND_PUBLISH_ENABLED).toBeUndefined();

    const workbook = await testApp.createWorkbook({
      name: "Default-off WB",
      cells: dynamicCells,
      createdBy: userId,
    });
    const result = await publishUseCase.execute(workbook.id, userId);

    assertFailure(result);
    expect(result.error.code).toBe("DYNAMIC_COMMAND_PUBLISH_DISABLED");
  });

  it("refuses a published dynamic version over HTTP without the capability, leaking no cells", async () => {
    const { workbook, version } = await publishDynamicVersion();

    const path = testApp.resolveOrpcPath(contract.workbooks.getWorkbookVersion, {
      id: workbook.id,
      versionId: version.id,
    });
    const response = await testApp
      .get(path)
      .withAuth(userId)
      .expect(StatusCodes.UPGRADE_REQUIRED);

    const serialized = JSON.stringify(response.body);
    expect(serialized).toContain("DYNAMIC_COMMAND_CLIENT_UPGRADE_REQUIRED");
    expect(serialized).not.toContain('"cells"');
    expect(serialized).not.toContain("toDevice");
    expect(serialized).not.toContain("sourceCellId");
  });

  it("returns the same published dynamic version intact to a capable client", async () => {
    const { workbook, version } = await publishDynamicVersion();

    const path = testApp.resolveOrpcPath(contract.workbooks.getWorkbookVersion, {
      id: workbook.id,
      versionId: version.id,
    });
    const response = await testApp
      .get(path)
      .withAuth(userId)
      .set(OPENJII_CAPABILITIES_HEADER, "dynamic-command-ref-v1")
      .expect(StatusCodes.OK);

    expect(response.body).toMatchObject({ id: version.id, version: 1 });
    expect(response.body.cells).toEqual(dynamicCells);
  });

  it("serves a static version unchanged to a capability-less client", async () => {
    const workbook = await testApp.createWorkbook({
      name: "Static qualification WB",
      cells: [
        { id: "c1", type: "command", isCollapsed: false, payload: { format: "string", content: "battery" } },
      ],
      createdBy: userId,
    });
    const published = await publishUseCase.execute(workbook.id, userId);
    assertSuccess(published);

    const path = testApp.resolveOrpcPath(contract.workbooks.getWorkbookVersion, {
      id: workbook.id,
      versionId: published.value.id,
    });
    const response = await testApp.get(path).withAuth(userId).expect(StatusCodes.OK);
    expect(response.body.cells).toEqual([
      { id: "c1", type: "command", isCollapsed: false, payload: { format: "string", content: "battery" } },
    ]);
  });

  it("logs refusals with codes and ids only, never cell payload content", async () => {
    const warnSpy = vi.spyOn(Logger.prototype, "warn");
    const { workbook, version } = await publishDynamicVersion();

    const path = testApp.resolveOrpcPath(contract.workbooks.getWorkbookVersion, {
      id: workbook.id,
      versionId: version.id,
    });
    await testApp.get(path).withAuth(userId).expect(StatusCodes.UPGRADE_REQUIRED);

    const refusalLogs = warnSpy.mock.calls.filter((call) =>
      JSON.stringify(call).includes("DYNAMIC_COMMAND_CLIENT_UPGRADE_REQUIRED"),
    );
    expect(refusalLogs.length).toBeGreaterThan(0);
    const serialized = JSON.stringify(warnSpy.mock.calls);
    expect(serialized).not.toContain("toDevice");
    expect(serialized).not.toContain('"ref"');
  });
});
