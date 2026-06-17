import { and, eq, resourceGrants } from "@repo/database";

import { assertSuccess } from "../common/utils/fp-utils";
import { ExperimentRepository } from "../experiments/core/repositories/experiment.repository";
import { TestHarness } from "../test/test-harness";
import { AuthorizationService } from "./authorization.service";

describe("experiment creation grants org ownership", () => {
  const testApp = TestHarness.App;
  let repository: ExperimentRepository;
  let service: AuthorizationService;
  let userId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    repository = testApp.module.get(ExperimentRepository);
    service = testApp.module.get(AuthorizationService);
    userId = await testApp.createTestUser({ name: "Grace Hopper" });
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("assigns the creator's org + an admin grant, and AuthorizationService permits update", async () => {
    const result = await repository.create(
      {
        name: `Owned ${crypto.randomUUID().slice(0, 8)}`,
        description: "x",
        status: "active",
        visibility: "private",
      },
      userId,
    );
    assertSuccess(result);
    const experiment = result.value[0];

    expect(experiment.organizationId).toBeTruthy();

    const grants = await testApp.database
      .select()
      .from(resourceGrants)
      .where(
        and(
          eq(resourceGrants.resourceType, "experiment"),
          eq(resourceGrants.resourceId, experiment.id),
          eq(resourceGrants.granteeType, "user"),
          eq(resourceGrants.granteeId, userId),
        ),
      );
    expect(grants).toHaveLength(1);
    expect(grants[0].role).toBe("admin");

    const decision = await service.can(userId, {
      resourceType: "experiment",
      resourceId: experiment.id,
      action: "update",
    });
    expect(decision.allow).toBe(true);
  });
});
