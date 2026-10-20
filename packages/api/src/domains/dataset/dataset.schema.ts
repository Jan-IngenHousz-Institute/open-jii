import { z } from "zod";

import { zResourceScope } from "../../shared/listing";
import { zExperimentAnnotationFlagType } from "../experiment/data-annotations/experiment-data-annotations.schema";
import { zDataLicense, zFundingReferenceList } from "../experiment/experiment.schema";
import { zOrcid } from "../user/user.schema";

export const zDatasetIdPathParam = z.object({
  id: z.string().uuid().describe("ID of the dataset"),
});

export const zDatasetState = z.enum(["draft", "published", "superseded", "withdrawn"]);

/** Embargo is a property of a published dataset: its metadata is public at once, its files later. */
export const zDatasetAccess = z.enum(["open", "embargoed"]);

/**
 * One credited author, copied from the profile when the dataset freezes so a citation never
 * changes with an account. An author added by name has no user and never an ORCID iD.
 */
export const zDatasetAuthor = z.object({
  userId: z.string().uuid().nullable(),
  givenName: z.string().trim().min(1).max(255),
  familyName: z.string().trim().min(1).max(255),
  orcid: zOrcid.nullable(),
  affiliation: z.string().trim().max(255).nullable(),
});

export const zDatasetFileKind = z.enum(["snapshot", "dataDictionary", "miappe", "roCrate"]);

export const zDatasetFile = z.object({
  kind: zDatasetFileKind,
  name: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  sha256: z.string().length(64),
});

export const zDepositStatus = z.enum([
  "uploading",
  "registering",
  "verifying",
  "deposited",
  "failed",
]);

export const zDepositEnvironment = z.enum(["sandbox", "production"]);

export const zDatasetDeposit = z.object({
  status: zDepositStatus,
  environment: zDepositEnvironment,
  attempts: z.number().int().nonnegative(),
});

/** A reading left out of the dataset's files, kept with its reason so the exclusion is auditable. */
export const zExcludedReading = z.object({
  rowId: z.string().min(1),
  reason: z.string().max(255),
});

/**
 * How a publication relates to the experiment, in DataCite's relation vocabulary, read from the
 * publication's side. A dataset's record states the inverse.
 */
export const zPublicationRelation = z.enum([
  "IsSupplementedBy",
  "Cites",
  "References",
  "Documents",
]);

export const zRelatedPublication = z.object({
  id: z.string().uuid(),
  relation: zPublicationRelation,
  doi: z.string().nullable(),
  url: z.string().url().nullable(),
  title: z.string().nullable(),
  authors: z.array(z.string()),
  year: z.number().int().nullable(),
});

export const zDataset = z.object({
  id: z.string().uuid(),
  experimentId: z.string().uuid(),
  version: z.number().int().positive(),
  state: zDatasetState,
  title: z.string(),
  description: z.string().nullable(),
  limitations: z.string().nullable(),
  authors: z.array(zDatasetAuthor),
  license: zDataLicense.nullable(),
  access: zDatasetAccess,
  embargoUntil: z.string().datetime().nullable(),
  funding: zFundingReferenceList,
  relatedPublications: z.array(zRelatedPublication),
  excludedReadings: z.array(zExcludedReading),
  doi: z.string().nullable(),
  deposit: zDatasetDeposit.nullable(),
  supersedesId: z.string().uuid().nullable(),
  files: z.array(zDatasetFile),
  createdAt: z.string().datetime(),
  publishedAt: z.string().datetime().nullable(),
  withdrawnAt: z.string().datetime().nullable(),
  withdrawalReason: z.string().nullable(),
});

export const zDatasetList = z.array(zDataset);

export const zListDatasetsQuery = z.object({
  scope: zResourceScope
    .optional()
    .describe("related adds the caller's own experiments' datasets, drafts included"),
});

/** What freezing would capture, counted now, since readings keep arriving until the freeze. */
export const zDatasetScope = z.object({
  version: z.number().int().positive(),
  readingCount: z.number().int().nonnegative(),
  countedAt: z.string().datetime(),
});

export const zFlaggedReading = z.object({
  rowId: z.string().min(1),
  plot: z.string().nullable(),
  flagType: zExperimentAnnotationFlagType,
  comment: z.string().nullable(),
  flaggedByName: z.string(),
  flaggedAt: z.string().datetime(),
});

export const zFlaggedReadingList = z.array(zFlaggedReading);

/** The record fields OpenAIRE needs before a dataset's DOI is harvested. */
export const zOpenAireFloorField = z.enum([
  "title",
  "creators",
  "publisher",
  "year",
  "type",
  "license",
  "access",
  "funding",
]);

export const zStandard = z.enum([
  "miappe",
  "brapi",
  "cropOntology",
  "greenhouseOntology",
  "sensorThings",
  "fair",
]);

export const zStandardVerdict = z.enum(["met", "partial", "notApplicable", "notAssessed"]);

export const zStandardReadiness = z.object({
  standard: zStandard,
  verdict: zStandardVerdict,
  filled: z.number().int().nonnegative().nullable(),
  total: z.number().int().positive().nullable(),
  reason: z.string(),
});

export const zDatasetReadiness = z.object({
  floor: z.object({
    filled: z.array(zOpenAireFloorField),
    missing: z.array(zOpenAireFloorField),
  }),
  standards: z.array(zStandardReadiness),
});

export const zPublishDatasetBody = z.object({
  excludedReadings: z.array(zExcludedReading),
  title: z.string().trim().min(1).max(255),
  description: z.string().trim().min(1),
  authors: z.array(zDatasetAuthor).min(1),
  limitations: z.string().trim().max(2000).optional(),
  license: zDataLicense,
  rightToPublish: z.literal(true),
  access: zDatasetAccess,
  embargoUntil: z.string().datetime().optional(),
});

/** What anyone may read without an account: never a Draft, never files that are embargoed or withdrawn. */
export const zPublicDataset = zDataset
  .omit({ excludedReadings: true, deposit: true, limitations: true })
  .extend({
    state: zDatasetState.exclude(["draft"]),
    citation: z.string(),
    publisher: z.string(),
    supersededById: z.string().uuid().nullable(),
  });

export type DatasetState = z.infer<typeof zDatasetState>;
export type DatasetAccess = z.infer<typeof zDatasetAccess>;
export type DatasetAuthor = z.infer<typeof zDatasetAuthor>;
export type DatasetFile = z.infer<typeof zDatasetFile>;
export type DatasetDeposit = z.infer<typeof zDatasetDeposit>;
export type DepositStatus = z.infer<typeof zDepositStatus>;
export type ExcludedReading = z.infer<typeof zExcludedReading>;
export type PublicationRelation = z.infer<typeof zPublicationRelation>;
export type RelatedPublication = z.infer<typeof zRelatedPublication>;
export type Dataset = z.infer<typeof zDataset>;
export type DatasetScope = z.infer<typeof zDatasetScope>;
export type FlaggedReading = z.infer<typeof zFlaggedReading>;
export type OpenAireFloorField = z.infer<typeof zOpenAireFloorField>;
export type Standard = z.infer<typeof zStandard>;
export type StandardVerdict = z.infer<typeof zStandardVerdict>;
export type StandardReadiness = z.infer<typeof zStandardReadiness>;
export type DatasetReadiness = z.infer<typeof zDatasetReadiness>;
export type PublishDatasetBody = z.infer<typeof zPublishDatasetBody>;
export type PublicDataset = z.infer<typeof zPublicDataset>;
