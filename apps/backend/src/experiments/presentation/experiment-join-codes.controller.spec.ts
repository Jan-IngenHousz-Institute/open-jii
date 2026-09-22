import { faker } from "@faker-js/faker";
import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api/contract";
import type {
  ExperimentJoinCode,
  ExperimentJoinCodeResponse,
} from "@repo/api/domains/experiment/join-codes/experiment-join-codes.schema";
import { eq, experimentJoinCodes } from "@repo/database";

import { assertSuccess } from "../../common/utils/fp-utils";
import type { SuperTestResponse } from "../../test/test-harness";
import { TestHarness } from "../../test/test-harness";
import { CreateJoinCodeUseCase } from "../application/use-cases/experiment-join-codes/create-join-code";

describe("ExperimentJoinCodesController", () => {
  const testApp = TestHarness.App;
  const path = (procedure: Parameters<typeof testApp.resolveOrpcPath>[0], id: string) =>
    testApp.resolveOrpcPath(procedure, { id });
  let createUseCase: CreateJoinCodeUseCase;
  let organizerId: string;
  let viewerId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    organizerId = await testApp.createTestUser({ email: "organizer@example.com" });
    viewerId = await testApp.createTestUser({ email: "viewer@example.com" });
    createUseCase = testApp.module.get(CreateJoinCodeUseCase);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  async function seedExperiment() {
    const { experiment } = await testApp.createExperiment({
      name: `Codes ${faker.string.uuid()}`,
      userId: organizerId,
      visibility: "public",
    });
    return experiment;
  }

  it("returns null before any code has been made", async () => {
    const experiment = await seedExperiment();

    const response: SuperTestResponse<ExperimentJoinCodeResponse> = await testApp
      .get(path(contract.experiments.getJoinCode, experiment.id))
      .withAuth(organizerId)
      .expect(StatusCodes.OK);

    expect(response.body).toEqual({ joinCode: null });
  });

  it("creates a code, returns 201, and reads it back", async () => {
    const experiment = await seedExperiment();

    const created: SuperTestResponse<ExperimentJoinCode> = await testApp
      .post(path(contract.experiments.createJoinCode, experiment.id))
      .withAuth(organizerId)
      .send({ expiresIn: "7d" })
      .expect(StatusCodes.CREATED);

    expect(created.body.code).toHaveLength(8);
    expect(created.body.redemptionCount).toBe(0);
    expect(created.body.createdBy).toBe(organizerId);

    const read: SuperTestResponse<ExperimentJoinCodeResponse> = await testApp
      .get(path(contract.experiments.getJoinCode, experiment.id))
      .withAuth(organizerId)
      .expect(StatusCodes.OK);

    expect(read.body.joinCode?.id).toBe(created.body.id);
  });

  it("defaults the expiry when the body omits it", async () => {
    const experiment = await seedExperiment();

    const created: SuperTestResponse<ExperimentJoinCode> = await testApp
      .post(path(contract.experiments.createJoinCode, experiment.id))
      .withAuth(organizerId)
      .send({})
      .expect(StatusCodes.CREATED);

    const offsetDays =
      (new Date(created.body.expiresAt ?? 0).getTime() - Date.now()) / (24 * 60 * 60 * 1000);
    expect(offsetDays).toBeGreaterThan(6.9);
    expect(offsetDays).toBeLessThan(7.1);
  });

  it("creating twice leaves exactly one active row", async () => {
    const experiment = await seedExperiment();

    await testApp
      .post(path(contract.experiments.createJoinCode, experiment.id))
      .withAuth(organizerId)
      .send({ expiresIn: "7d" })
      .expect(StatusCodes.CREATED);
    const second: SuperTestResponse<ExperimentJoinCode> = await testApp
      .post(path(contract.experiments.createJoinCode, experiment.id))
      .withAuth(organizerId)
      .send({ expiresIn: "1d" })
      .expect(StatusCodes.CREATED);

    const read: SuperTestResponse<ExperimentJoinCodeResponse> = await testApp
      .get(path(contract.experiments.getJoinCode, experiment.id))
      .withAuth(organizerId)
      .expect(StatusCodes.OK);
    expect(read.body.joinCode?.id).toBe(second.body.id);
  });

  it("still returns an expired code, so the card can say so", async () => {
    const experiment = await seedExperiment();
    const created = await createUseCase.execute(experiment.id, organizerId, "1d");
    assertSuccess(created);
    await testApp.database
      .update(experimentJoinCodes)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(experimentJoinCodes.id, created.value.id));

    const read: SuperTestResponse<ExperimentJoinCodeResponse> = await testApp
      .get(path(contract.experiments.getJoinCode, experiment.id))
      .withAuth(organizerId)
      .expect(StatusCodes.OK);

    expect(read.body.joinCode?.id).toBe(created.value.id);
    expect(new Date(read.body.joinCode?.expiresAt ?? 0).getTime()).toBeLessThan(Date.now());
  });

  it("revokes with 204, and revoking again still succeeds", async () => {
    const experiment = await seedExperiment();
    assertSuccess(await createUseCase.execute(experiment.id, organizerId, "7d"));

    await testApp
      .delete(path(contract.experiments.revokeJoinCode, experiment.id))
      .withAuth(organizerId)
      .expect(StatusCodes.NO_CONTENT);
    await testApp
      .delete(path(contract.experiments.revokeJoinCode, experiment.id))
      .withAuth(organizerId)
      .expect(StatusCodes.NO_CONTENT);

    const read: SuperTestResponse<ExperimentJoinCodeResponse> = await testApp
      .get(path(contract.experiments.getJoinCode, experiment.id))
      .withAuth(organizerId)
      .expect(StatusCodes.OK);
    expect(read.body.joinCode).toBeNull();
  });

  it.each([
    ["get", (id: string) => testApp.get(path(contract.experiments.getJoinCode, id))],
    ["create", (id: string) => testApp.post(path(contract.experiments.createJoinCode, id))],
    ["revoke", (id: string) => testApp.delete(path(contract.experiments.revokeJoinCode, id))],
  ])("refuses a contributing viewer on %s", async (_label, request) => {
    // `viewer` carries contribute, not share. Handing out access is the organizer's.
    const experiment = await seedExperiment();
    await testApp.addExperimentCollaborator(experiment.id, viewerId);

    await request(experiment.id).withAuth(viewerId).expect(StatusCodes.FORBIDDEN);
  });

  it("refuses a signed-out caller", async () => {
    const experiment = await seedExperiment();

    await testApp
      .get(path(contract.experiments.getJoinCode, experiment.id))
      .withoutAuth()
      .expect(StatusCodes.UNAUTHORIZED);
  });

  it("is not throttled: the organizer routes carry no limit", async () => {
    const experiment = await seedExperiment();

    // Well past the joiner routes' 10 a minute, from one organizer.
    for (let i = 0; i < 12; i++) {
      await testApp
        .get(path(contract.experiments.getJoinCode, experiment.id))
        .withAuth(organizerId)
        .expect(StatusCodes.OK);
    }
  });
});
