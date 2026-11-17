import { z } from "zod";

import { experimentDataDestinationEnum, experimentDataRecordTypeEnum } from "@repo/database";

export const zExperimentDataRecordType = z.enum(experimentDataRecordTypeEnum.enumValues);
export type ExperimentDataRecordType = z.infer<typeof zExperimentDataRecordType>;

export const zExperimentDataDestination = z.enum(experimentDataDestinationEnum.enumValues);
export type ExperimentDataDestination = z.infer<typeof zExperimentDataDestination>;

/** The copies each kind of record keeps beside Postgres. */
export const OWED_COPIES: Record<ExperimentDataRecordType, ExperimentDataDestination[]> = {
  annotation: ["lakehouse"],
  metadata_sheet: ["lakehouse"],
};

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

/** What a later write has to still hold for it to land: the row, and the claim on it. */
export type OutboxClaim = Pick<ClaimedOutboxRow, "id" | "claimedAt">;
