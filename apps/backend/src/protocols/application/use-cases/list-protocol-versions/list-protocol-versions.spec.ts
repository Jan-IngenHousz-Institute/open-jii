import { faker } from "@faker-js/faker";

import { assertSuccess } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { ProtocolRepository } from "../../../core/repositories/protocol.repository";
import { ListProtocolVersionsUseCase } from "./list-protocol-versions";

describe("ListProtocolVersionsUseCase", () => {
  const testApp = TestHarness.App;
  let userId: string;
  let useCase: ListProtocolVersionsUseCase;
  let protocolRepository: ProtocolRepository;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    userId = await testApp.createTestUser({});
    useCase = testApp.module.get(ListProtocolVersionsUseCase);
    protocolRepository = testApp.module.get(ProtocolRepository);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("returns versions newest-first", async () => {
    const created = await protocolRepository.create(
      { name: "P", code: [{ step: 1 }], family: "multispeq" },
      userId,
    );
    assertSuccess(created);
    const protocolId = created.value[0].id;
    const minted = await protocolRepository.mintVersion(protocolId, {
      code: [{ step: 2 }],
      family: "multispeq",
      createdBy: userId,
    });
    assertSuccess(minted);

    const result = await useCase.execute(protocolId);
    assertSuccess(result);
    expect(result.value.map((v) => v.version)).toEqual([2, 1]);
  });

  it("returns an empty list for a protocol with no versions", async () => {
    const result = await useCase.execute(faker.string.uuid());
    assertSuccess(result);
    expect(result.value).toEqual([]);
  });
});
