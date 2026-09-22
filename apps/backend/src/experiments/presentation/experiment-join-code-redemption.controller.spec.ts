import { faker } from "@faker-js/faker";
import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api/contract";
import type {
  JoinCodePreview,
  RedeemJoinCodeResponse,
} from "@repo/api/domains/experiment/join-codes/experiment-join-codes.schema";
import { formatJoinCode } from "@repo/api/domains/experiment/join-codes/experiment-join-codes.schema";

import { ErrorCodes } from "../../common/utils/error-codes";
import { assertSuccess } from "../../common/utils/fp-utils";
import type { SuperTestResponse } from "../../test/test-harness";
import { TestHarness } from "../../test/test-harness";
import { CreateJoinCodeUseCase } from "../application/use-cases/experiment-join-codes/create-join-code";

describe("ExperimentJoinCodeRedemptionController", () => {
  const testApp = TestHarness.App;
  const resolvePath = (code: string) =>
    testApp.resolveOrpcPath(contract.experiments.resolveJoinCode, { code });
  const redeemPath = (code: string) =>
    testApp.resolveOrpcPath(contract.experiments.redeemJoinCode, { code });
  let createUseCase: CreateJoinCodeUseCase;
  let organizerId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    organizerId = await testApp.createTestUser({ email: "organizer@example.com" });
    createUseCase = testApp.module.get(CreateJoinCodeUseCase);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  async function seedCode() {
    const { experiment } = await testApp.createExperiment({
      name: `Redemption ${faker.string.uuid()}`,
      userId: organizerId,
      visibility: "public",
    });
    const created = await createUseCase.execute(experiment.id, organizerId, "7d");
    assertSuccess(created);
    return { experiment, code: created.value.code };
  }

  it("resolves a code into a preview", async () => {
    const { experiment, code } = await seedCode();
    const studentId = await testApp.createTestUser({ email: "preview@example.com" });

    const response: SuperTestResponse<JoinCodePreview> = await testApp
      .get(resolvePath(code))
      .withAuth(studentId)
      .expect(StatusCodes.OK);

    expect(response.body.experiment.id).toBe(experiment.id);
    expect(response.body.membershipStatus).toBe("none");
    expect(response.body.experiment.hasWorkbook).toBe(false);
  });

  it("reaches the same code through its hyphenated and lowercase spellings", async () => {
    // The projector shows `XXXX-XXXX` and the phone keyboard lowercases; the path
    // parameter normalizes, so all three spellings are one row.
    const { experiment, code } = await seedCode();
    const studentId = await testApp.createTestUser({ email: "spellings@example.com" });

    for (const spelling of [code, formatJoinCode(code), formatJoinCode(code).toLowerCase()]) {
      const response: SuperTestResponse<JoinCodePreview> = await testApp
        .get(resolvePath(spelling))
        .withAuth(studentId)
        .expect(StatusCodes.OK);
      expect(response.body.experiment.id).toBe(experiment.id);
    }
  });

  it("rejects a code that cannot be a code at all", async () => {
    const studentId = await testApp.createTestUser({ email: "malformed@example.com" });

    await testApp.get(resolvePath("ABC")).withAuth(studentId).expect(StatusCodes.BAD_REQUEST);
  });

  it("returns 404 JOIN_CODE_NOT_FOUND for an unknown code", async () => {
    const studentId = await testApp.createTestUser({ email: "unknown@example.com" });

    const response: SuperTestResponse<{ message: string; data?: { code?: string } }> = await testApp
      .get(resolvePath("ZZZZZZZZ"))
      .withAuth(studentId)
      .expect(StatusCodes.NOT_FOUND);

    expect(response.body.data?.code).toBe(ErrorCodes.JOIN_CODE_NOT_FOUND);
    expect(response.body.message).toBe("This code isn't valid");
  });

  it("redeems, then reports already_member on the second call", async () => {
    const { experiment, code } = await seedCode();
    const studentId = await testApp.createTestUser({ email: "redeemer@example.com" });

    const first: SuperTestResponse<RedeemJoinCodeResponse> = await testApp
      .post(redeemPath(code))
      .withAuth(studentId)
      .expect(StatusCodes.OK);
    expect(first.body).toEqual({ experimentId: experiment.id, outcome: "joined" });

    const second: SuperTestResponse<RedeemJoinCodeResponse> = await testApp
      .post(redeemPath(code))
      .withAuth(studentId)
      .expect(StatusCodes.OK);
    expect(second.body.outcome).toBe("already_member");

    const preview: SuperTestResponse<JoinCodePreview> = await testApp
      .get(resolvePath(code))
      .withAuth(studentId)
      .expect(StatusCodes.OK);
    expect(preview.body.membershipStatus).toBe("member");
  });

  it("refuses a signed-out caller", async () => {
    const { code } = await seedCode();

    await testApp.get(resolvePath(code)).withoutAuth().expect(StatusCodes.UNAUTHORIZED);
  });

  it("allows ten resolves a minute, then returns 429", async () => {
    const { code } = await seedCode();
    const studentId = await testApp.createTestUser({ email: "flood@example.com" });

    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) {
      const response = await testApp.get(resolvePath(code)).withAuth(studentId);
      statuses.push(response.status);
    }

    expect(statuses.slice(0, 10)).toEqual(Array<number>(10).fill(StatusCodes.OK));
    expect(statuses[10]).toBe(StatusCodes.TOO_MANY_REQUESTS);
  });

  it("gives resolve and redeem a bucket each", async () => {
    // The throttle key includes the handler, so exhausting the preview must not lock
    // a student out of the join they were previewing.
    const { code } = await seedCode();
    const studentId = await testApp.createTestUser({ email: "buckets@example.com" });

    for (let i = 0; i < 11; i++) {
      await testApp.get(resolvePath(code)).withAuth(studentId);
    }
    await testApp.get(resolvePath(code)).withAuth(studentId).expect(StatusCodes.TOO_MANY_REQUESTS);

    await testApp.post(redeemPath(code)).withAuth(studentId).expect(StatusCodes.OK);
  });

  it("keys the limit per user, not per address", async () => {
    // A workshop is one room behind one address; one student's scanning must not
    // exhaust the rest of the room.
    const { code } = await seedCode();
    const floodedId = await testApp.createTestUser({ email: "first@example.com" });
    const otherId = await testApp.createTestUser({ email: "second@example.com" });

    for (let i = 0; i < 11; i++) {
      await testApp
        .get(resolvePath(code))
        .withAuth(floodedId)
        .set("X-Forwarded-For", "198.51.100.7, 70.132.0.1");
    }
    await testApp
      .get(resolvePath(code))
      .withAuth(floodedId)
      .set("X-Forwarded-For", "198.51.100.7, 70.132.0.1")
      .expect(StatusCodes.TOO_MANY_REQUESTS);

    await testApp
      .get(resolvePath(code))
      .withAuth(otherId)
      .set("X-Forwarded-For", "198.51.100.7, 70.132.0.1")
      .expect(StatusCodes.OK);
  });
});
