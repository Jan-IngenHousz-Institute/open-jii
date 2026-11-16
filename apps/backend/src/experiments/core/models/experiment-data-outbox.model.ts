import { z } from "zod";

import { experimentDataDestinationEnum, experimentDataRecordTypeEnum } from "@repo/database";

export const zExperimentDataRecordType = z.enum(experimentDataRecordTypeEnum.enumValues);
export type ExperimentDataRecordType = z.infer<typeof zExperimentDataRecordType>;

export const zExperimentDataDestination = z.enum(experimentDataDestinationEnum.enumValues);
export type ExperimentDataDestination = z.infer<typeof zExperimentDataDestination>;

/** The copies each kind of record keeps beside Postgres, where the environment has each one. */
export const OWED_COPIES: Record<ExperimentDataRecordType, ExperimentDataDestination[]> = {
  annotation: ["lakehouse", "serving_store"],
  metadata_sheet: ["lakehouse", "serving_store"],
};

/** Seconds before each retry of a copy. The last repeats: a copy that keeps failing is never dropped. */
export const COPY_RETRY_WAITS_S = [10, 60, 5 * 60, 15 * 60, 60 * 60];

/** A copy that has failed this many times has outlasted every short wait, and counts as failed. */
export const COPY_FAILED_AFTER_ATTEMPTS = COPY_RETRY_WAITS_S.length;

/** A record a copy is owed, by the keys every copy finds it under. */
export interface CopyKey {
  id: string;
  experimentId: string;
}

/** A record whose current state its copies are owed. */
export interface OwedRecord {
  recordType: ExperimentDataRecordType;
  recordId: string;
  experimentId: string;
}

/** An outbox row a worker holds while it applies it. */
export interface ClaimedOutboxRow extends OwedRecord {
  id: string;
  destination: ExperimentDataDestination;
  attempts: number;
  claimedAt: Date;
}

/** The copies still owed, and how long the oldest has waited since it was first owed. */
export interface WaitingCopies {
  waiting: number;
  oldestWaitingSeconds: number;
}

/** What a later write has to still hold for it to land: the row, and the claim on it. */
export type OutboxClaim = Pick<ClaimedOutboxRow, "id" | "claimedAt">;
