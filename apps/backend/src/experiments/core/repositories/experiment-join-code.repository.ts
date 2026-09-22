import { Injectable, Inject } from "@nestjs/common";
import { randomInt } from "node:crypto";

import type {
  ExperimentStatus,
  ExperimentVisibility,
} from "@repo/api/domains/experiment/experiment.schema";
import {
  JOIN_CODE_ALPHABET,
  JOIN_CODE_LENGTH,
} from "@repo/api/domains/experiment/join-codes/experiment-join-codes.schema";
import {
  and,
  eq,
  experimentJoinCodes,
  experiments,
  isNull,
  resourceGrants,
  sql,
} from "@repo/database";
import type { DatabaseInstance, DbOrTx, Transaction } from "@repo/database";

import { Result, tryCatch } from "../../../common/utils/fp-utils";
import { owningOrganizationNameSql } from "../../../common/utils/owning-organization";
import { JOIN_GRANT_ROLE } from "../join-grant";
import type { ExperimentJoinCodeDto } from "../models/experiment-join-code.model";

/** The experiment columns every join-code decision and the joiner's preview are made from. */
export interface JoinCodeExperimentRow {
  id: string;
  status: ExperimentStatus;
  visibility: ExperimentVisibility;
  name: string;
  description: string | null;
  organizationName: string | null;
  workbookVersionId: string | null;
}

/**
 * Read without the creator-profile join the access read carries: a joiner is a
 * stranger to the experiment, and an experiment whose creator has no profile row
 * must still be reachable by its code.
 */
const experimentFields = {
  id: experiments.id,
  status: experiments.status,
  visibility: experiments.visibility,
  name: experiments.name,
  description: experiments.description,
  organizationName: owningOrganizationNameSql("experiments"),
  workbookVersionId: experiments.workbookVersionId,
};

@Injectable()
export class ExperimentJoinCodeRepository {
  constructor(
    @Inject("DATABASE")
    private readonly database: DatabaseInstance,
  ) {}

  /** Run the caller's steps on one connection. Every write a join code makes is ordered by locks. */
  transaction<T>(work: (tx: Transaction) => Promise<T>): Promise<T> {
    return this.database.transaction(work);
  }

  /**
   * Eight draws from the 31-glyph alphabet: about 8.5 x 10^11 values, behind a
   * per-user throttle on the only two routes that can probe them.
   */
  generateCode(): string {
    let code = "";
    for (let i = 0; i < JOIN_CODE_LENGTH; i++) {
      code += JOIN_CODE_ALPHABET[randomInt(0, JOIN_CODE_ALPHABET.length)];
    }
    return code;
  }

  /** The experiment's live code, expired or not. Expiry is the client's to render. */
  async findActive(experimentId: string): Promise<Result<ExperimentJoinCodeDto | null>> {
    return tryCatch(async () => {
      const rows = await this.database
        .select()
        .from(experimentJoinCodes)
        .where(
          and(
            eq(experimentJoinCodes.experimentId, experimentId),
            isNull(experimentJoinCodes.revokedAt),
          ),
        )
        .limit(1);

      return rows.length > 0 ? rows[0] : null;
    });
  }

  async findByCode(code: string): Promise<Result<ExperimentJoinCodeDto | null>> {
    return tryCatch(() => this.readByCode(this.database, code));
  }

  /**
   * An unlocked read on the caller's own handle, for the one thing a redemption has
   * to know before it can take any lock: which experiment the code belongs to.
   * `experiment_id` is written once at insert and never rewritten, so it cannot go
   * stale; everything the decision actually rests on is re-read under locks.
   */
  async readByCode(executor: DbOrTx, code: string): Promise<ExperimentJoinCodeDto | null> {
    const rows = await executor
      .select()
      .from(experimentJoinCodes)
      .where(eq(experimentJoinCodes.code, code))
      .limit(1);

    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Lock the code row and read it back, so revoke, regenerate and a second redeem
   * queue behind whoever holds it. Taken **after** the experiment row: create and
   * revoke go experiment-then-code, and a redemption that took the two in the other
   * order deadlocked against them.
   */
  async lockByCode(tx: DbOrTx, code: string): Promise<ExperimentJoinCodeDto | null> {
    const rows = await tx
      .select()
      .from(experimentJoinCodes)
      .where(eq(experimentJoinCodes.code, code))
      .limit(1)
      .for("update");

    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Lock the experiment row and read the state every join-code decision needs.
   *
   * Taken first by every path, so the lock order is uniform: experiment row, then
   * code row. The experiment row exists before its first code does, which is what
   * makes it the one point two concurrent regenerates can serialize on.
   *
   * `update` for create and revoke. `share` for redeem, which still conflicts with
   * archive's `UPDATE` — so an in-flight archive blocks the redemption until it
   * commits and the redemption then refuses — while letting a room full of students
   * redeem at once instead of queueing one at a time.
   */
  async lockExperiment(
    tx: DbOrTx,
    experimentId: string,
    mode: "update" | "share",
  ): Promise<JoinCodeExperimentRow | null> {
    // `organizationName` is a correlated subquery, which Postgres refuses to lock;
    // the locking reads take the plain columns and nothing else needs the name.
    const query = tx
      .select({ ...experimentFields, organizationName: sql<string | null>`NULL` })
      .from(experiments)
      .where(eq(experiments.id, experimentId))
      .limit(1);

    const rows = await (mode === "update" ? query.for("update") : query.for("share"));

    return rows.length > 0 ? rows[0] : null;
  }

  /** The unlocked read behind the joiner's preview. */
  async findExperiment(experimentId: string): Promise<Result<JoinCodeExperimentRow | null>> {
    return tryCatch(async () => {
      const rows = await this.database
        .select(experimentFields)
        .from(experiments)
        .where(eq(experiments.id, experimentId))
        .limit(1);

      return rows.length > 0 ? rows[0] : null;
    });
  }

  /**
   * Mint the contributing grant a redemption buys, on the caller's transaction.
   * `onConflictDoNothing` rather than an upsert: someone who already holds a higher
   * tier must not be demoted to `viewer` by scanning a code. Reports whether a row
   * was actually written, which is what the redemption counter is allowed to count.
   */
  async insertJoinGrant(
    tx: DbOrTx,
    values: { experimentId: string; userId: string; createdBy: string | null },
  ): Promise<boolean> {
    const inserted = await tx
      .insert(resourceGrants)
      .values({
        resourceType: "experiment",
        resourceId: values.experimentId,
        granteeType: "user",
        granteeId: values.userId,
        role: JOIN_GRANT_ROLE,
        createdBy: values.createdBy,
      })
      .onConflictDoNothing()
      .returning({ id: resourceGrants.id });

    return inserted.length > 0;
  }

  /**
   * Revoke every unrevoked row, not just an unexpired one: an expired-but-live row
   * still occupies the one-active-code index and would block the replacement.
   */
  async revokeActive(tx: DbOrTx, experimentId: string, revokedAt: Date): Promise<void> {
    await tx
      .update(experimentJoinCodes)
      .set({ revokedAt })
      .where(
        and(
          eq(experimentJoinCodes.experimentId, experimentId),
          isNull(experimentJoinCodes.revokedAt),
        ),
      );
  }

  async insert(
    tx: DbOrTx,
    values: { experimentId: string; code: string; createdBy: string; expiresAt: Date | null },
  ): Promise<ExperimentJoinCodeDto> {
    const [row] = await tx.insert(experimentJoinCodes).values(values).returning();
    return row;
  }

  /** Counted only where a grant was actually written, so a double scan counts once. */
  async incrementRedemptionCount(tx: DbOrTx, id: string): Promise<void> {
    await tx
      .update(experimentJoinCodes)
      .set({ redemptionCount: sql`${experimentJoinCodes.redemptionCount} + 1` })
      .where(eq(experimentJoinCodes.id, id));
  }
}
