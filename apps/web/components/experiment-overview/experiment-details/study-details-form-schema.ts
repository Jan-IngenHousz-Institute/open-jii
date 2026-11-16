import { z } from "zod";

import type { Experiment, FundingReference } from "@repo/api/domains/experiment/experiment.schema";
import {
  validateStudyDates,
  zDataLicense,
  zFundingReferenceList,
} from "@repo/api/domains/experiment/experiment.schema";
import type {
  StudyRecord,
  StudySubject,
} from "@repo/api/domains/experiment/study/experiment-study.schema";
import {
  zRelatedWork,
  zStudySubject,
} from "@repo/api/domains/experiment/study/experiment-study.schema";

// Cleared fields hold null, not undefined: react-hook-form treats an undefined
// onChange value as "revert to the default", which un-clears the field.
export const studyDetailsFormSchema = z
  .object({
    startDate: z.string().date().nullable(),
    endDate: z.string().date().nullable(),
    subjects: z.array(zStudySubject),
    experimentalDesign: z.string().nullable(),
    relatedWork: z.array(zRelatedWork),
    license: zDataLicense.nullable(),
    fundingReferences: zFundingReferenceList,
  })
  .superRefine((val, ctx) => {
    validateStudyDates(val.startDate, val.endDate, ctx);
  });

export type StudyDetailsFormValues = z.infer<typeof studyDetailsFormSchema>;

export const EMPTY_FUNDING_REFERENCE: FundingReference = {
  funderName: "",
  funderIdentifier: null,
  funderIdentifierType: null,
  awardNumber: null,
  awardTitle: null,
  awardUri: null,
};

/** The scaffold stores no subjects yet, so an experiment's stored organism stands in as one. */
export const studySubjects = (
  experiment: Experiment,
  record: StudyRecord | undefined,
): StudySubject[] =>
  record?.subjects ?? (experiment.organism ? [{ label: experiment.organism, term: null }] : []);

export const experimentToFormValues = (
  experiment: Experiment,
  record: StudyRecord | undefined,
): StudyDetailsFormValues => ({
  startDate: experiment.startDate,
  endDate: experiment.endDate,
  subjects: studySubjects(experiment, record),
  experimentalDesign: experiment.experimentalDesign,
  relatedWork: record?.relatedWork ?? [],
  license: experiment.license,
  fundingReferences: experiment.fundingReferences ?? [],
});
