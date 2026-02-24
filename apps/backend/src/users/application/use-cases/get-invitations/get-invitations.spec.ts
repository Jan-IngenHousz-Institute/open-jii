import { assertSuccess, success } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import type { EmailPort } from "../../../core/ports/email.port";
import { EMAIL_PORT } from "../../../core/ports/email.port";
import { CreateInvitationsUseCase } from "../create-invitations/create-invitations";
import { GetInvitationsUseCase } from "./get-invitations";

describe("GetInvitationsUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: GetInvitationsUseCase;
  let createUseCase: CreateInvitationsUseCase;
  let emailPort: EmailPort;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(GetInvitationsUseCase);
    createUseCase = testApp.module.get(CreateInvitationsUseCase);
    emailPort = testApp.module.get(EMAIL_PORT);

    vi.restoreAllMocks();
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("should return empty array when no invitations exist", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Empty Invitations Test",
      userId: testUserId,
    });

    const result = await useCase.execute("experiment", experiment.id);

    assertSuccess(result);
    expect(result.value).toHaveLength(0);
  });

  it("should return pending invitations for a resource", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "List Invitations Test",
      userId: testUserId,
    });

    vi.spyOn(emailPort, "sendInvitationNotification").mockResolvedValue(success(undefined));

    await createUseCase.execute(
      "experiment",
      experiment.id,
      [
        { email: "invite1@example.com", role: "member" },
        { email: "invite2@example.com", role: "admin" },
      ],
      testUserId,
    );

    vi.restoreAllMocks();

    const result = await useCase.execute("experiment", experiment.id);

    assertSuccess(result);
    expect(result.value).toHaveLength(2);

    const emails = result.value.map((inv) => inv.email);
    expect(emails).toContain("invite1@example.com");
    expect(emails).toContain("invite2@example.com");
  });

  it("should include inviter name and resource name in results", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Enriched Invitations Test",
      userId: testUserId,
    });

    vi.spyOn(emailPort, "sendInvitationNotification").mockResolvedValue(success(undefined));

    await createUseCase.execute(
      "experiment",
      experiment.id,
      [{ email: "enriched@example.com", role: "member" }],
      testUserId,
    );

    vi.restoreAllMocks();

    const result = await useCase.execute("experiment", experiment.id);

    assertSuccess(result);
    expect(result.value).toHaveLength(1);
    expect(result.value[0].resourceName).toBe("Enriched Invitations Test");
    expect(result.value[0].invitedByName).toBeDefined();
  });

  it("should not return invitations for a different resource", async () => {
    const { experiment: exp1 } = await testApp.createExperiment({
      name: "Experiment A",
      userId: testUserId,
    });
    const { experiment: exp2 } = await testApp.createExperiment({
      name: "Experiment B",
      userId: testUserId,
    });

    vi.spyOn(emailPort, "sendInvitationNotification").mockResolvedValue(success(undefined));

    await createUseCase.execute(
      "experiment",
      exp1.id,
      [{ email: "exp1only@example.com", role: "member" }],
      testUserId,
    );

    vi.restoreAllMocks();

    const result = await useCase.execute("experiment", exp2.id);

    assertSuccess(result);
    expect(result.value).toHaveLength(0);
  });
});
