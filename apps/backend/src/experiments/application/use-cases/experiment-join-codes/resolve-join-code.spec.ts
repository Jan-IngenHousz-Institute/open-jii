import { faker } from "@faker-js/faker";
import { StatusCodes } from "http-status-codes";

import { eq, experimentJoinCodes, experiments, workbookVersions } from "@repo/database";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { assertFailure, assertSuccess } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { ExperimentJoinRequestRepository } from "../../../core/repositories/experiment-join-request.repository";
import { CreateJoinCodeUseCase } from "./create-join-code";
import { ResolveJoinCodeUseCase } from "./resolve-join-code";
import { RevokeJoinCodeUseCase } from "./revoke-join-code";

describe("ResolveJoinCodeUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: ResolveJoinCodeUseCase;
  let createUseCase: CreateJoinCodeUseCase;
  let revokeUseCase: RevokeJoinCodeUseCase;
  let joinRequestRepository: ExperimentJoinRequestRepository;
  let organizerId: string;
  let studentId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    organizerId = await testApp.createTestUser({ email: "organizer@example.com" });
    studentId = await testApp.createTestUser({ email: "student@example.com" });
    useCase = testApp.module.get(ResolveJoinCodeUseCase);
    createUseCase = testApp.module.get(CreateJoinCodeUseCase);
    revokeUseCase = testApp.module.get(RevokeJoinCodeUseCase);
    joinRequestRepository = testApp.module.get(ExperimentJoinRequestRepository);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  async function seedCode(options: { organizationId?: string } = {}) {
    const { experiment } = await testApp.createExperiment({
      name: `Resolve ${faker.string.uuid()}`,
      userId: organizerId,
      visibility: "public",
      ...(options.organizationId ? { organizationId: options.organizationId } : {}),
    });
    const created = await createUseCase.execute(experiment.id, organizerId, "7d");
    assertSuccess(created);
    return { experiment, code: created.value };
  }

  it("previews the experiment for a stranger, with no relationship", async () => {
    const { experiment, code } = await seedCode();

    const result = await useCase.execute(code.code, studentId);

    assertSuccess(result);
    expect(result.value.experiment.id).toBe(experiment.id);
    expect(result.value.experiment.name).toBe(experiment.name);
    expect(result.value.membershipStatus).toBe("none");
    expect(result.value.expiresAt).toEqual(code.expiresAt);
  });

  it("names the owning organization, and omits a personal workspace", async () => {
    const organizationId = await testApp.createOrganization("Canopy Lab");
    await testApp.addOrganizationMember(organizationId, organizerId, "owner");
    const shared = await seedCode({ organizationId });
    const personal = await seedCode();

    const sharedPreview = await useCase.execute(shared.code.code, studentId);
    const personalPreview = await useCase.execute(personal.code.code, studentId);

    assertSuccess(sharedPreview);
    assertSuccess(personalPreview);
    expect(sharedPreview.value.experiment.organizationName).toBe("Canopy Lab");
    expect(personalPreview.value.experiment.organizationName).toBeNull();
  });

  it("reports whether a workbook is pinned, which is what measuring needs", async () => {
    const { experiment, code } = await seedCode();

    const withoutWorkbook = await useCase.execute(code.code, studentId);
    assertSuccess(withoutWorkbook);
    expect(withoutWorkbook.value.experiment.hasWorkbook).toBe(false);

    const workbook = await testApp.createWorkbook({ name: "WB", createdBy: organizerId });
    const [version] = await testApp.database
      .insert(workbookVersions)
      .values({ workbookId: workbook.id, version: 1, cells: [], createdBy: organizerId })
      .returning();
    await testApp.database
      .update(experiments)
      .set({ workbookId: workbook.id, workbookVersionId: version.id })
      .where(eq(experiments.id, experiment.id));

    const withWorkbook = await useCase.execute(code.code, studentId);
    assertSuccess(withWorkbook);
    expect(withWorkbook.value.experiment.hasWorkbook).toBe(true);
  });

  it("says member for someone who can already contribute", async () => {
    const { experiment, code } = await seedCode();
    await testApp.addExperimentCollaborator(experiment.id, studentId);

    const result = await useCase.execute(code.code, studentId);

    assertSuccess(result);
    expect(result.value.membershipStatus).toBe("member");
  });

  it("says pending_request for someone waiting on approval", async () => {
    const { experiment, code } = await seedCode();
    assertSuccess(await joinRequestRepository.create(experiment.id, studentId, "let me in"));

    const result = await useCase.execute(code.code, studentId);

    assertSuccess(result);
    expect(result.value.membershipStatus).toBe("pending_request");
  });

  it("returns JOIN_CODE_NOT_FOUND for a code nothing was ever issued against", async () => {
    const result = await useCase.execute("ZZZZZZZZ", studentId);

    assertFailure(result);
    expect(result.error.statusCode).toBe(StatusCodes.NOT_FOUND);
    expect(result.error.code).toBe(ErrorCodes.JOIN_CODE_NOT_FOUND);
    expect(result.error.message).toBe("This code isn't valid");
  });

  it("returns JOIN_CODE_EXPIRED for a revoked code", async () => {
    const { experiment, code } = await seedCode();
    assertSuccess(await revokeUseCase.execute(experiment.id));

    const result = await useCase.execute(code.code, studentId);

    assertFailure(result);
    expect(result.error.statusCode).toBe(StatusCodes.NOT_FOUND);
    expect(result.error.code).toBe(ErrorCodes.JOIN_CODE_EXPIRED);
    expect(result.error.message).toBe("This code has expired or was revoked");
  });

  it("returns JOIN_CODE_EXPIRED once the expiry has passed", async () => {
    const { code } = await seedCode();
    await testApp.database
      .update(experimentJoinCodes)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(experimentJoinCodes.id, code.id));

    const result = await useCase.execute(code.code, studentId);

    assertFailure(result);
    expect(result.error.code).toBe(ErrorCodes.JOIN_CODE_EXPIRED);
  });

  it("still resolves a code with no expiry at all", async () => {
    const { experiment } = await testApp.createExperiment({
      name: `Never ${faker.string.uuid()}`,
      userId: organizerId,
      visibility: "public",
    });
    const created = await createUseCase.execute(experiment.id, organizerId, "never");
    assertSuccess(created);

    const result = await useCase.execute(created.value.code, studentId);

    assertSuccess(result);
    expect(result.value.expiresAt).toBeNull();
  });

  it("refuses once the experiment is archived", async () => {
    const { experiment, code } = await seedCode();
    await testApp.database
      .update(experiments)
      .set({ status: "archived" })
      .where(eq(experiments.id, experiment.id));

    const result = await useCase.execute(code.code, studentId);

    assertFailure(result);
    expect(result.error.statusCode).toBe(StatusCodes.FORBIDDEN);
    expect(result.error.message).toBe("This experiment is archived");
  });

  it("writes nothing and never moves the counter", async () => {
    const { code } = await seedCode();

    assertSuccess(await useCase.execute(code.code, studentId));
    assertSuccess(await useCase.execute(code.code, studentId));

    const [row] = await testApp.database
      .select()
      .from(experimentJoinCodes)
      .where(eq(experimentJoinCodes.id, code.id));
    expect(row.redemptionCount).toBe(0);
  });
});
