import { assertSuccess } from "../../../common/utils/fp-utils";
import { TestHarness } from "../../../test/test-harness";
import { ExperimentRepository } from "./experiment.repository";

/**
 * Browse ordering ranks by how closely the caller is tied to each row (owned, shared,
 * org, public) before the per-entity secondary key. Access is settled elsewhere: every
 * row here is already readable, the tier only decides what comes first.
 */
describe("ExperimentRepository relationship-tier ordering", () => {
  const testApp = TestHarness.App;
  let repository: ExperimentRepository;
  let caller: string;
  let author: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    repository = testApp.module.get(ExperimentRepository);
    caller = await testApp.createTestUser({});
    author = await testApp.createTestUser({});
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("orders owned above shared above org above public", async () => {
    const publicOrg = await testApp.createOrganization();
    await testApp.addOrganizationMember(publicOrg, author, "owner");
    const { experiment: publicExp } = await testApp.createExperiment({
      name: "Tierprobe public",
      userId: author,
      visibility: "public",
      organizationId: publicOrg,
    });

    const memberOrg = await testApp.createOrganization();
    await testApp.addOrganizationMember(memberOrg, author, "owner");
    await testApp.addOrganizationMember(memberOrg, caller, "member");
    const { experiment: orgExp } = await testApp.createExperiment({
      name: "Tierprobe org",
      userId: author,
      visibility: "private",
      organizationId: memberOrg,
    });

    const sharedOrg = await testApp.createOrganization();
    await testApp.addOrganizationMember(sharedOrg, author, "owner");
    const { experiment: sharedExp } = await testApp.createExperiment({
      name: "Tierprobe shared",
      userId: author,
      visibility: "private",
      organizationId: sharedOrg,
    });
    await testApp.addExperimentCollaborator(sharedExp.id, caller);

    const { experiment: ownedExp } = await testApp.createExperiment({
      name: "Tierprobe owned",
      userId: caller,
      visibility: "private",
    });

    const result = await repository.findAll(caller);

    assertSuccess(result);
    const ranked = result.value
      .filter((e) => e.name.startsWith("Tierprobe"))
      .map((e) => e.id)
      .filter((id) => [ownedExp.id, sharedExp.id, orgExp.id, publicExp.id].includes(id));

    expect(ranked).toEqual([ownedExp.id, sharedExp.id, orgExp.id, publicExp.id]);
  });

  it("keeps recency as the tiebreak inside a tier", async () => {
    const { experiment: older } = await testApp.createExperiment({
      name: "Recencyprobe older",
      userId: caller,
    });
    const { experiment: newer } = await testApp.createExperiment({
      name: "Recencyprobe newer",
      userId: caller,
    });

    const result = await repository.findAll(caller);

    assertSuccess(result);
    const ids = result.value.filter((e) => e.name.startsWith("Recencyprobe")).map((e) => e.id);
    expect(ids).toEqual([newer.id, older.id]);
  });

  it("admits nothing for scope=related without a caller, rather than matching on undefined", async () => {
    await testApp.createExperiment({
      name: "Anonprobe public",
      userId: author,
      visibility: "public",
    });

    const result = await repository.findAll(undefined as unknown as string, "related");

    assertSuccess(result);
    expect(result.value).toEqual([]);
  });

  it("lets a strong public match outrank a weak owned one when searching", async () => {
    await testApp.createExperiment({
      name: "Quorndalf",
      userId: author,
      visibility: "public",
    });
    await testApp.createExperiment({
      name: "Unrelated title",
      description: "mentions quorndalf once in passing",
      userId: caller,
      visibility: "private",
    });

    const result = await repository.findAll(caller, undefined, undefined, "quorndalf");

    assertSuccess(result);
    // Tier weights near-ties, it does not bury relevance: the exact name match wins
    // even though the caller owns the other row.
    expect(result.value[0].name).toBe("Quorndalf");
  });
});
