import { assertSuccess } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { ProtocolRepository } from "../../../core/repositories/protocol.repository";
import { GetProtocolUsageUseCase } from "./get-protocol-usage";

describe("GetProtocolUsageUseCase", () => {
  const testApp = TestHarness.App;
  let userId: string;
  let useCase: GetProtocolUsageUseCase;
  let protocolRepository: ProtocolRepository;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    userId = await testApp.createTestUser({});
    useCase = testApp.module.get(GetProtocolUsageUseCase);
    protocolRepository = testApp.module.get(ProtocolRepository);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  async function createProtocolId() {
    const created = await protocolRepository.create(
      { name: "P", code: [{ step: 1 }], family: "multispeq" },
      userId,
    );
    assertSuccess(created);
    return created.value[0].id;
  }

  it("counts workbooks that reference the protocol", async () => {
    const protocolId = await createProtocolId();
    const cell = {
      id: "p1",
      type: "protocol",
      isCollapsed: false,
      payload: { protocolId, version: 1 },
    };
    await testApp.createWorkbook({ name: "WB A", cells: [cell], createdBy: userId });
    await testApp.createWorkbook({ name: "WB B", cells: [cell], createdBy: userId });

    const result = await useCase.execute(protocolId);
    assertSuccess(result);
    expect(result.value.count).toBe(2);
    expect(result.value.workbooks.map((w) => w.name).sort()).toEqual(["WB A", "WB B"]);
  });

  it("reports zero usage for an unreferenced protocol", async () => {
    const protocolId = await createProtocolId();

    const result = await useCase.execute(protocolId);
    assertSuccess(result);
    expect(result.value.count).toBe(0);
    expect(result.value.workbooks).toEqual([]);
  });
});
