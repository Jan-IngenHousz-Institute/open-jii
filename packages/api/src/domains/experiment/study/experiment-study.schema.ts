import { z } from "zod";

import { zColumnTerm } from "../columns/experiment-columns.schema";

/** An NCBI Taxonomy entry, which MIAPPE recommends for the organism. */
export const zOrganism = z.object({
  taxonId: z.string().regex(/^\d+$/),
  name: z.string(),
  commonName: z.string().optional(),
});

export const zOrganismSearchQuery = z.object({
  query: z.string().trim().min(2).max(100),
});

export const zOrganismSearchResponse = z.object({
  organisms: z.array(zOrganism),
});

/**
 * What the study is about, as DataCite's Subject records it: a term from any vocabulary, such as an
 * organism from NCBI Taxonomy or a habitat from ENVO, or a free keyword with no term.
 */
export const zStudySubject = z.object({
  label: z.string().trim().min(1).max(255),
  term: zColumnTerm.nullable(),
});

/** The DataCite relation types the study details offer for related work. */
export const zRelationType = z.enum([
  "IsDescribedBy",
  "IsSupplementTo",
  "References",
  "IsDerivedFrom",
  "IsCitedBy",
]);

/** A paper, dataset or page related to the study, as DataCite's RelatedIdentifier records it. */
export const zRelatedWork = z.object({
  identifier: z
    .string()
    .trim()
    .min(1, "Write a DOI or a link")
    .max(500)
    .describe("A DOI such as 10.1234/example, or a link"),
  relationType: zRelationType,
});

/** The study fields the experiment record does not carry yet, read on their own. */
export const zStudyRecord = z.object({
  subjects: z.array(zStudySubject),
  relatedWork: z.array(zRelatedWork),
});

export type Organism = z.infer<typeof zOrganism>;
export type OrganismSearchResponse = z.infer<typeof zOrganismSearchResponse>;
export type StudySubject = z.infer<typeof zStudySubject>;
export type RelationType = z.infer<typeof zRelationType>;
export type RelatedWork = z.infer<typeof zRelatedWork>;
export type StudyRecord = z.infer<typeof zStudyRecord>;
