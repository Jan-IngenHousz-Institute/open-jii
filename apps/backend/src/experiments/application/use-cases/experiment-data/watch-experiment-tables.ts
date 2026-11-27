import { Injectable } from "@nestjs/common";

import { AuthorizationService } from "../../../../authorization/authorization.service";
import { AppError, failure } from "../../../../common/utils/fp-utils";
import type { Result } from "../../../../common/utils/fp-utils";
import { UserRepository } from "../../../../users/core/repositories/user.repository";
import type {
  ExperimentDataSource,
  ExperimentTablesChange,
} from "../../../core/models/experiment-data.model";
import { ExperimentTableChangesService } from "../../services/experiment-table-changes.service";
import { RecentChecks } from "../../services/recent-checks";

// A stream asks before every send, and an answer holds this long, so a reader who lost access or
// was signed out hears nothing more once it has passed.
export const ACCESS_CHECK_MS = 5_000;

/**
 * How a stream's request signed in, which its access rechecks ask about again: a session by
 * whether it is still signed in, an API key by the key's own row.
 */
export type StreamSignIn =
  | { kind: "session"; id: string; isSignedIn: () => Promise<boolean> }
  | { kind: "apiKey"; id: string };

@Injectable()
export class WatchExperimentTablesUseCase {
  // Every stream asks again before it sends, so a reader's streams share each answer.
  private readonly signIns = new RecentChecks(ACCESS_CHECK_MS);
  private readonly readers = new RecentChecks(ACCESS_CHECK_MS);

  constructor(
    private readonly tableChanges: ExperimentTableChangesService,
    private readonly authz: AuthorizationService,
    private readonly userRepository: UserRepository,
  ) {}

  execute(
    experimentId: string,
    userId: string,
    source: ExperimentDataSource,
    signIn: StreamSignIn,
    signal?: AbortSignal,
  ): Result<AsyncGenerator<ExperimentTablesChange, void>> {
    if (source !== "store") {
      return failure(AppError.notFound("Table changes are streamed only from the serving store"));
    }

    return this.tableChanges.open(
      experimentId,
      userId,
      () => this.mayRead(experimentId, userId, signIn),
      signal,
    );
  }

  private async mayRead(
    experimentId: string,
    userId: string,
    signIn: StreamSignIn,
    isRetry = false,
  ): Promise<boolean> {
    const signedIn = await this.signIns.ask(signIn.id, () => this.isStillSignedIn(signIn, userId));
    if (!signedIn.isTrue) {
      return false;
    }
    const reads = await this.readers.ask(`${userId}:${experimentId}`, () =>
      this.canRead(experimentId, userId),
    );
    if (!reads.isTrue) {
      return false;
    }

    // One check can run long enough for the other's answer to pass the window, which is then asked
    // again; checks too slow to answer within it end the stream.
    const now = Date.now();
    const isStale = [signedIn, reads].some(({ askedAt }) => now - askedAt >= ACCESS_CHECK_MS);
    if (!isStale) {
      return true;
    }
    return isRetry ? false : this.mayRead(experimentId, userId, signIn, true);
  }

  private async isStillSignedIn(signIn: StreamSignIn, userId: string): Promise<boolean> {
    if (signIn.kind === "session") {
      return signIn.isSignedIn();
    }

    // Better Auth 1.7 counts every check of a key against its quota, and its row does not.
    const key = await this.userRepository.findApiKeyState(signIn.id);
    if (key.isFailure()) {
      throw key.error;
    }
    const state = key.value;
    if (state === null) {
      return false;
    }
    const hasExpired = state.expiresAt !== null && state.expiresAt.getTime() <= Date.now();
    return state.referenceId === userId && state.enabled && !hasExpired;
  }

  private async canRead(experimentId: string, userId: string): Promise<boolean> {
    const decision = await this.authz.can(userId, {
      resourceType: "experiment",
      resourceId: experimentId,
      action: "read",
    });
    return decision.allow;
  }
}
