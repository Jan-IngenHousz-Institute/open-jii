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
  contributor: ["lakehouse"],
  device: ["lakehouse"],
};

/**
 * A record whose current state its copies are owed. An annotation or a sheet carries its
 * experiment; a contributor or a device belongs to none.
 */
export const zOwedRecord = z.discriminatedUnion("recordType", [
  z.object({
    recordType: zExperimentDataRecordType.extract(["annotation", "metadata_sheet"]),
    recordId: z.string(),
    experimentId: z.string(),
  }),
  z.object({
    recordType: zExperimentDataRecordType.exclude(["annotation", "metadata_sheet"]),
    recordId: z.string(),
    experimentId: z.null(),
  }),
]);
export type OwedRecord = z.infer<typeof zOwedRecord>;

/** An outbox row a worker holds while it applies it. */
export type ClaimedOutboxRow = OwedRecord & {
  id: string;
  destination: ExperimentDataDestination;
  attempts: number;
  claimedAt: Date;
};

/** The copies still owed, and how long the oldest has waited since it was first owed. */
export interface WaitingCopies {
  waiting: number;
  oldestWaitingSeconds: number;
}

/** What a later write has to still hold for it to land: the row, and the claim on it. */
export type OutboxClaim = Pick<ClaimedOutboxRow, "id" | "claimedAt">;
