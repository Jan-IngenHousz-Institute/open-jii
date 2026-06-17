import { and, eq, resourceGrants } from "@repo/database";
import type { ResourceType } from "@repo/database";

import { assertSuccess } from "../common/utils/fp-utils";
import { MacroRepository } from "../macros/core/repositories/macro.repository";
import { ProtocolRepository } from "../protocols/core/repositories/protocol.repository";
import { TestHarness } from "../test/test-harness";
import { WorkbookRepository } from "../workbooks/core/repositories/workbook.repository";
import { AuthorizationService } from "./authorization.service";

describe("owned-entity create grants org ownership", () => {
  const testApp = TestHarness.App;
  let macroRepo: MacroRepository;
  let protocolRepo: ProtocolRepository;
  let workbookRepo: WorkbookRepository;
  let service: AuthorizationService;
  let userId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    macroRepo = testApp.module.get(MacroRepository);
    protocolRepo = testApp.module.get(ProtocolRepository);
    workbookRepo = testApp.module.get(WorkbookRepository);
    service = testApp.module.get(AuthorizationService);
    userId = await testApp.createTestUser({ name: "Owner" });
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  async function assertOwnedWithAdminGrant(resourceType: ResourceType, resourceId: string) {
    expect(resourceId).toBeTruthy();
    const grants = await testApp.database
      .select()
      .from(resourceGrants)
      .where(
        and(
          eq(resourceGrants.resourceType, resourceType),
          eq(resourceGrants.resourceId, resourceId),
          eq(resourceGrants.granteeType, "user"),
          eq(resourceGrants.granteeId, userId),
        ),
      );
    expect(grants).toHaveLength(1);
    expect(grants[0].role).toBe("admin");

    const decision = await service.can(userId, { resourceType, resourceId, action: "update" });
    expect(decision.allow).toBe(true);
  }

  it("macro: sets organizationId + admin grant, AuthorizationService permits update", async () => {
    const result = await macroRepo.create(
      {
        name: `M ${crypto.randomUUID().slice(0, 8)}`,
        description: "d",
        language: "python",
        code: "Y29kZQ==",
      },
      userId,
    );
    assertSuccess(result);
    expect(result.value[0].organizationId).toBeTruthy();
    await assertOwnedWithAdminGrant("macro", result.value[0].id);
  });

  it("protocol: sets organizationId + admin grant", async () => {
    const result = await protocolRepo.create(
      {
        name: `P ${crypto.randomUUID().slice(0, 8)}`,
        description: "d",
        code: [{ steps: [] }],
        family: "multispeq",
      },
      userId,
    );
    assertSuccess(result);
    expect(result.value[0].organizationId).toBeTruthy();
    await assertOwnedWithAdminGrant("protocol", result.value[0].id);
  });

  it("workbook: sets organizationId + admin grant", async () => {
    const result = await workbookRepo.create(
      { name: `W ${crypto.randomUUID().slice(0, 8)}`, description: "d", cells: [], metadata: {} },
      userId,
    );
    assertSuccess(result);
    expect(result.value[0].organizationId).toBeTruthy();
    await assertOwnedWithAdminGrant("workbook", result.value[0].id);
  });
});
