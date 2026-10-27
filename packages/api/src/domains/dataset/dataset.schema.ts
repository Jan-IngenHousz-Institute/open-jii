import { z } from "zod";

import { zResourceScope } from "../../shared/listing";
import { zExperimentAnnotationFlagType } from "../experiment/data-annotations/experiment-data-annotations.schema";
import { zDataLicense, zFundingReferenceList } from "../experiment/experiment.schema";
import { zSkipReason } from "../experiment/sessions/experiment-sessions.schema";

/** An ORCID iD in its canonical form; it only ever comes from a connected ORCID account. */
const zOrcid = z
  .string()
  .regex(/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/, "Must be an ORCID iD like 0000-0002-1825-0097");

export const zDatasetIdPathParam = z.object({
  id: z.string().uuid().describe("ID of the dataset"),
});

export const zDatasetState = z.enum(["draft", "published", "superseded", "withdrawn"]);

/** Embargo is a property of a published dataset: its metadata is public at once, its files later. */
export const zDatasetAccess = z.enum(["open", "embargoed"]);

export const zAuthorRequest = z.enum(["pending", "accepted"]);

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
  /** A member someone else lists accepts before Freeze. Null for the publisher and a name only. */
  request: zAuthorRequest.nullable(),
});

/** The DataCite contributorType values that describe a person's part in collecting the data. */
export const zContributorType = z.enum([
  "DataCollector",
  "DataCurator",
  "DataManager",
  "ProjectLeader",
  "ProjectMember",
  "Researcher",
  "Supervisor",
  "Other",
]);

/** Credited in the dataset's record with a role, never in its citation. */
export const zDatasetContributor = z.object({
  userId: z.string().uuid().nullable(),
  givenName: z.string().trim().min(1).max(255),
  familyName: z.string().trim().min(1).max(255),
  orcid: zOrcid.nullable(),
  contributorType: zContributorType,
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

export const zDepositStep = z.enum(["upload", "register", "verify"]);

export const zDatasetDeposit = z.object({
  status: zDepositStatus,
  environment: zDepositEnvironment,
  attempts: z.number().int().nonnegative(),
  /** The step that ran out of retries, set only while the status is failed. */
  failedStep: zDepositStep.nullable(),
});

/** Zenodo has no withdraw action in its API, so its copy follows a request a person sends. */
export const zZenodoCopyState = z.enum(["requestPrepared", "removed"]);

/** The study details as they read when the dataset froze. */
export const zDatasetStudyDetails = z.object({
  organism: z.string().nullable(),
  startDate: z.string().date().nullable(),
  endDate: z.string().date().nullable(),
  experimentalDesign: z.string().nullable(),
  growthFacility: z.string().nullable(),
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
  contributors: z.array(zDatasetContributor),
  license: zDataLicense.nullable(),
  access: zDatasetAccess,
  embargoUntil: z.string().datetime().nullable(),
  funding: zFundingReferenceList,
  relatedPublications: z.array(zRelatedPublication),
  excludedReadings: z.array(zExcludedReading),
  /** Frozen with the dataset, so all three are null on a Draft. */
  studyDetails: zDatasetStudyDetails.nullable(),
  readingCount: z.number().int().nonnegative().nullable(),
  plotCount: z.number().int().nonnegative().nullable(),
  /** Views of the dataset page, signed in or not. Null on a Draft, which has no page. */
  viewCount: z.number().int().nonnegative().nullable(),
  doi: z.string().nullable(),
  deposit: zDatasetDeposit.nullable(),
  supersedesId: z.string().uuid().nullable(),
  files: z.array(zDatasetFile),
  createdAt: z.string().datetime(),
  publishedAt: z.string().datetime().nullable(),
  withdrawnAt: z.string().datetime().nullable(),
  withdrawalReason: z.string().nullable(),
  zenodoCopy: zZenodoCopyState.nullable(),
});

export const zDatasetList = z.array(zDataset);

export const zListDatasetsQuery = z.object({
  scope: zResourceScope
    .optional()
    .describe("related adds the caller's own experiments' datasets, drafts included"),
  search: z.string().trim().max(255).optional().describe("Matches title, description and organism"),
});

/** What freezing would capture, counted now, since readings keep arriving until the freeze. */
export const zDatasetScope = z.object({
  version: z.number().int().positive(),
  readingCount: z.number().int().nonnegative(),
  countedAt: z.string().datetime(),
  /** The latest published version, so Scope can say what this one adds. */
  previous: z
    .object({
      version: z.number().int().positive(),
      readingCount: z.number().int().nonnegative(),
    })
    .nullable(),
});

/** One column of a reading, formatted for display. */
export const zReadingValue = z.object({
  column: z.string(),
  value: z.string(),
});

export const zFlaggedReading = z.object({
  rowId: z.string().min(1),
  plot: z.string().nullable(),
  measuredAt: z.string().datetime(),
  values: z.array(zReadingValue),
  flagType: zExperimentAnnotationFlagType,
  comment: z.string().nullable(),
  flaggedByName: z.string(),
  flaggedAt: z.string().datetime(),
});

export const zFlaggedReadingList = z.array(zFlaggedReading);

export const zMeasuredTwiceReading = z.object({
  rowId: z.string().min(1),
  measuredByName: z.string(),
  measuredAt: z.string().datetime(),
  values: z.array(zReadingValue),
});

/** A plot more than one reading landed on without a repeat, still waiting for a person. */
export const zMeasuredTwicePlot = z.object({
  plot: z.string(),
  readings: z.array(zMeasuredTwiceReading).min(2),
});

/** A plot a measurer skipped and nobody came back to that day. */
export const zSkippedPlot = z.object({
  plot: z.string(),
  reason: zSkipReason,
  skippedByName: z.string(),
  skippedAt: z.string().datetime(),
});

export const zDatasetPlotChecks = z.object({
  measuredTwice: z.array(zMeasuredTwicePlot),
  skipped: z.array(zSkippedPlot),
});

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
  contributors: z.array(zDatasetContributor),
  limitations: z.string().trim().max(2000).optional(),
  license: zDataLicense,
  rightToPublish: z.literal(true),
  access: zDatasetAccess,
  embargoUntil: z.string().datetime().optional(),
});

export const zWithdrawDatasetBody = z.object({
  reason: z.string().trim().min(1).max(500),
});

/** What anyone may read without an account: never a Draft, never files that are embargoed or withdrawn. */
export const zPublicDataset = zDataset
  .omit({
    excludedReadings: true,
    deposit: true,
    viewCount: true,
  })
  .extend({
    state: zDatasetState.exclude(["draft"]),
    citation: z.string(),
    publisher: z.string(),
    supersededById: z.string().uuid().nullable(),
    supersededByVersion: z.number().int().positive().nullable(),
    /** How many readings Curate left out, without saying which. */
    excludedCount: z.number().int().nonnegative(),
    /** A sandbox DOI is a test and is never offered as a citation. */
    depositEnvironment: zDepositEnvironment.nullable(),
  });

export type DatasetState = z.infer<typeof zDatasetState>;
export type DatasetAccess = z.infer<typeof zDatasetAccess>;
export type DatasetAuthor = z.infer<typeof zDatasetAuthor>;
export type ContributorType = z.infer<typeof zContributorType>;
export type DatasetContributor = z.infer<typeof zDatasetContributor>;
export type DatasetFile = z.infer<typeof zDatasetFile>;
export type DatasetDeposit = z.infer<typeof zDatasetDeposit>;
export type DepositStatus = z.infer<typeof zDepositStatus>;
export type DepositStep = z.infer<typeof zDepositStep>;
export type ZenodoCopyState = z.infer<typeof zZenodoCopyState>;
export type DatasetStudyDetails = z.infer<typeof zDatasetStudyDetails>;
export type ReadingValue = z.infer<typeof zReadingValue>;
export type MeasuredTwicePlot = z.infer<typeof zMeasuredTwicePlot>;
export type MeasuredTwiceReading = z.infer<typeof zMeasuredTwiceReading>;
export type SkippedPlot = z.infer<typeof zSkippedPlot>;
export type DatasetPlotChecks = z.infer<typeof zDatasetPlotChecks>;
export type WithdrawDatasetBody = z.infer<typeof zWithdrawDatasetBody>;
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
