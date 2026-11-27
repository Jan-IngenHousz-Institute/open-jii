import { fromPartial } from "@total-typescript/shoehorn";

import { apiKeys, eq } from "@repo/database";

import { AuthorizationService } from "../../../../authorization/authorization.service";
import type { AccessDecision } from "../../../../authorization/authorization.service";
import { assertFailure, assertSuccess, success } from "../../../../common/utils/fp-utils";
import type { Result } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { UserRepository } from "../../../../users/core/repositories/user.repository";
import type {
  ExperimentTableMetadata,
  ExperimentTablesChange,
} from "../../../core/models/experiment-data.model";
import { SERVING_STORE_PORT } from "../../../core/ports/serving-store.port";
import type { ServingStorePort } from "../../../core/ports/serving-store.port";
import { ExperimentDataRepository } from "../../../core/repositories/experiment-data.repository";
import { ExperimentTableChangesService } from "../../services/experiment-table-changes.service";
import { ACCESS_CHECK_MS, WatchExperimentTablesUseCase } from "./watch-experiment-tables";
import type { StreamSignIn } from "./watch-experiment-tables";

const RAW: ExperimentTableMetadata = {
  identifier: "raw_data",
  tableType: "static",
  displayName: null,
  rowCount: 10,
  latestRowAt: "2026-11-16T10:00:00.000Z",
  schemaRevision: "r1",
};

describe("WatchExperimentTablesUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: WatchExperimentTablesUseCase;
  let tableChanges: ExperimentTableChangesService;
  let request: AbortController;

  async function* changes(): AsyncGenerator<ExperimentTablesChange, void> {
    await Promise.resolve();
    yield { type: "heartbeat" };
  }

  /** The session the harness signs a user in with, still signed in unless a test says otherwise. */
  function sessionOf(userId: string, isSignedIn = () => Promise.resolve(true)): StreamSignIn {
    return { kind: "session", id: `session-${userId}`, isSignedIn };
  }

  async function keyRowOf(id: string) {
    const [row] = await testApp.database.select().from(apiKeys).where(eq(apiKeys.id, id));
    return row;
  }

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});

    useCase = testApp.module.get(WatchExperimentTablesUseCase);
    tableChanges = testApp.module.get(ExperimentTableChangesService);
    request = new AbortController();
  });

  afterEach(() => {
    request.abort();
    vi.useRealTimers();
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("should refuse a warehouse reader as not found and open no stream", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Test Experiment",
      userId: testUserId,
    });
    const open = vi.spyOn(tableChanges, "open");

    const result = useCase.execute(experiment.id, testUserId, "warehouse", sessionOf(testUserId));

    assertFailure(result);
    expect(result.error.code).toBe("NOT_FOUND");
    expect(open).not.toHaveBeenCalled();
  });

  it("should open a store stream for the user with the signal it was given", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Test Experiment",
      userId: testUserId,
    });
    const stream = success(changes());
    const open = vi.spyOn(tableChanges, "open").mockReturnValue(stream);

    const result = useCase.execute(
      experiment.id,
      testUserId,
      "store",
      sessionOf(testUserId),
      request.signal,
    );

    expect(result).toBe(stream);
    expect(open).toHaveBeenCalledWith(
      experiment.id,
      testUserId,
      expect.any(Function),
      request.signal,
    );
  });

  describe("over an open stream", () => {
    beforeEach(() => {
      vi.spyOn(testApp.module.get(ExperimentDataRepository), "listTablesAfresh").mockResolvedValue(
        success([RAW]),
      );
    });

    it("should send the tables to a reader who may still read", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment",
        userId: testUserId,
      });

      const opened = useCase.execute(
        experiment.id,
        testUserId,
        "store",
        sessionOf(testUserId),
        request.signal,
      );
      assertSuccess(opened);

      expect(await opened.value.next()).toMatchObject({
        value: { type: "changed", tables: [{ identifier: "raw_data", totalRows: 10 }] },
      });
    });

    it("should end the stream without sending once its reader is removed from the experiment", async () => {
      const owner = await testApp.createTestUser({});
      const { experiment } = await testApp.createExperiment({ name: "Shared", userId: owner });
      const grant = await testApp.addExperimentCollaborator(experiment.id, testUserId);

      const opened = useCase.execute(
        experiment.id,
        testUserId,
        "store",
        sessionOf(testUserId),
        request.signal,
      );
      assertSuccess(opened);
      await testApp.removeResourceGrant(grant.id);

      expect(await opened.value.next()).toEqual({ value: undefined, done: true });
    });

    it("should keep sending to a stream whose API key is live, counting no request against the key", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Scripted",
        userId: testUserId,
      });
      const key = await testApp.createApiKey(testUserId);

      const opened = useCase.execute(
        experiment.id,
        testUserId,
        "store",
        { kind: "apiKey", id: key.id },
        request.signal,
      );
      assertSuccess(opened);

      expect(await opened.value.next()).toMatchObject({ value: { type: "changed" } });
      expect(await keyRowOf(key.id)).toMatchObject({
        requestCount: key.requestCount,
        lastRequest: key.lastRequest,
      });
    });

    it.each([
      {
        change: "is revoked",
        act: (id: string) => testApp.database.delete(apiKeys).where(eq(apiKeys.id, id)),
      },
      {
        change: "expires",
        act: (id: string) =>
          testApp.database
            .update(apiKeys)
            .set({ expiresAt: new Date(Date.now() - 1_000) })
            .where(eq(apiKeys.id, id)),
      },
      {
        change: "is turned off",
        act: (id: string) =>
          testApp.database.update(apiKeys).set({ enabled: false }).where(eq(apiKeys.id, id)),
      },
    ])("should end the stream at its next check once its API key $change", async ({ act }) => {
      const { experiment } = await testApp.createExperiment({
        name: "Scripted",
        userId: testUserId,
      });
      const key = await testApp.createApiKey(testUserId);

      const opened = useCase.execute(
        experiment.id,
        testUserId,
        "store",
        { kind: "apiKey", id: key.id },
        request.signal,
      );
      assertSuccess(opened);
      await act(key.id);

      expect(await opened.value.next()).toEqual({ value: undefined, done: true });
    });

    it("should end the stream without sending once its session is revoked", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment",
        userId: testUserId,
      });
      let isSessionLive = true;

      const opened = useCase.execute(
        experiment.id,
        testUserId,
        "store",
        sessionOf(testUserId, () => Promise.resolve(isSessionLive)),
        request.signal,
      );
      assertSuccess(opened);
      isSessionLive = false;

      expect(await opened.value.next()).toEqual({ value: undefined, done: true });
    });
  });

  it("should send a listing read after the change it watches for, never one a page had begun before", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Busy",
      userId: testUserId,
    });
    let answerPage: (listing: Result<ExperimentTableMetadata[]>) => void = () => undefined;
    vi.spyOn(testApp.module.get<ServingStorePort>(SERVING_STORE_PORT), "getExperimentTableMetadata")
      .mockReturnValueOnce(
        new Promise((resolve) => {
          answerPage = resolve;
        }),
      )
      .mockResolvedValue(success([{ ...RAW, rowCount: 11 }]));
    const repository = testApp.module.get(ExperimentDataRepository);
    const freshListing = vi.spyOn(repository, "listTablesAfresh");

    // The page's listing counts 10 rows; the 11th arrives before the watch lists.
    const page = repository.listedTablesMetadata(experiment.id, "store");
    const opened = useCase.execute(
      experiment.id,
      testUserId,
      "store",
      sessionOf(testUserId),
      request.signal,
    );
    assertSuccess(opened);
    const sent = opened.value.next();
    await vi.waitFor(() => expect(freshListing).toHaveBeenCalled());
    answerPage(success([RAW]));

    const pageListing = await page;
    assertSuccess(pageListing);
    expect(pageListing.value[0].rowCount).toBe(10);
    expect(await sent).toMatchObject({
      value: { type: "changed", tables: [{ identifier: "raw_data", totalRows: 11 }] },
    });
  });

  describe("rechecking access", () => {
    /** Opens streams without starting them, and gives back the access check each would ask. */
    function openStreams(
      experimentId: string,
      userId: string,
      signIn: StreamSignIn,
      count: number,
    ) {
      const open = vi.spyOn(tableChanges, "open").mockImplementation(() => success(changes()));
      const opened = open.mock.calls.length;
      for (let stream = 0; stream < count; stream++) {
        useCase.execute(experimentId, userId, "store", signIn, request.signal);
      }
      return open.mock.calls.slice(opened).map(([, , mayRead]) => mayRead);
    }

    it("should ask once a window for the session and the reader's access, however many streams ask", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Popular",
        userId: testUserId,
      });
      const isSignedIn = vi.fn(() => Promise.resolve(true));
      const can = vi.spyOn(testApp.module.get(AuthorizationService), "can");

      const checks = openStreams(experiment.id, testUserId, sessionOf(testUserId, isSignedIn), 200);
      const answers = await Promise.all(checks.map((mayRead) => mayRead()));

      expect(answers.every(Boolean)).toBe(true);
      expect(isSignedIn).toHaveBeenCalledTimes(1);
      expect(can).toHaveBeenCalledTimes(1);
    });

    it("should ask again for a sign-in that passed its window while the access check ran", async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      const { experiment } = await testApp.createExperiment({
        name: "Slow check",
        userId: testUserId,
      });
      // Signed out right after the first answer.
      const isSignedIn = vi
        .fn<() => Promise<boolean>>()
        .mockResolvedValueOnce(true)
        .mockResolvedValue(false);
      // The access check takes the whole window to answer.
      vi.spyOn(testApp.module.get(AuthorizationService), "can").mockImplementationOnce(() => {
        vi.setSystemTime(Date.now() + ACCESS_CHECK_MS);
        return Promise.resolve(fromPartial<AccessDecision>({ allow: true }));
      });
      const [mayRead] = openStreams(
        experiment.id,
        testUserId,
        sessionOf(testUserId, isSignedIn),
        1,
      );

      expect(await mayRead()).toBe(false);
      expect(isSignedIn).toHaveBeenCalledTimes(2);
    });

    it("should ask again once the window has passed", async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      const { experiment } = await testApp.createExperiment({
        name: "Popular",
        userId: testUserId,
      });
      const isSignedIn = vi.fn(() => Promise.resolve(true));
      const can = vi.spyOn(testApp.module.get(AuthorizationService), "can");
      const [mayRead] = openStreams(
        experiment.id,
        testUserId,
        sessionOf(testUserId, isSignedIn),
        1,
      );

      await mayRead();
      vi.setSystemTime(Date.now() + ACCESS_CHECK_MS - 1);
      await mayRead();
      expect(can).toHaveBeenCalledTimes(1);
      vi.setSystemTime(Date.now() + 1);
      await mayRead();

      expect(isSignedIn).toHaveBeenCalledTimes(2);
      expect(can).toHaveBeenCalledTimes(2);
    });

    it("should read an API key's own row and the reader's access once a window, however many streams ask", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Scripted",
        userId: testUserId,
      });
      const key = await testApp.createApiKey(testUserId);
      const keyReads = vi.spyOn(testApp.module.get(UserRepository), "findApiKeyState");
      const can = vi.spyOn(testApp.module.get(AuthorizationService), "can");

      const checks = openStreams(experiment.id, testUserId, { kind: "apiKey", id: key.id }, 200);
      const answers = await Promise.all(checks.map((mayRead) => mayRead()));

      expect(answers.every(Boolean)).toBe(true);
      expect(keyReads).toHaveBeenCalledTimes(1);
      expect(can).toHaveBeenCalledTimes(1);
    });

    it("should ask for each reader and each session on its own", async () => {
      const owner = await testApp.createTestUser({});
      const { experiment } = await testApp.createExperiment({ name: "Shared", userId: owner });
      await testApp.addExperimentCollaborator(experiment.id, testUserId);
      const can = vi.spyOn(testApp.module.get(AuthorizationService), "can");

      const [ownerReads] = openStreams(experiment.id, owner, sessionOf(owner), 1);
      const [readerReads] = openStreams(experiment.id, testUserId, sessionOf(testUserId), 1);
      const answers = await Promise.all([ownerReads(), readerReads()]);

      expect(answers).toEqual([true, true]);
      expect(can).toHaveBeenCalledTimes(2);
    });
  });
});
