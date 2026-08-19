import { z } from "zod";

/**
 * A person credited as a contributor on an experiment: someone who holds a grant on
 * it, and can therefore add measurements and annotations.
 *
 * Deliberately narrower than the sharing routes' collaborators list — no email and
 * no tier — because this is the public-facing credit, readable by anyone who can
 * read the experiment, whereas enumerating who holds *what* access needs
 * `can(share)`. On an experiment that anonymizes contributors, every field is the
 * pseudonym the measurement rows already carry.
 */
export const zExperimentContributor = z.object({
  /**
   * The contributor's user id — or, when the experiment anonymizes contributors,
   * the opaque pseudonym that stands in for it. Not a uuid in that case: handing
   * out the real id alongside pseudonymised data rows would let any reader join the
   * two and recover who is who. Treat it as an identifier for display keys only.
   */
  userId: z.string().min(1),
  firstName: z.string(),
  lastName: z.string(),
  avatarUrl: z.string().nullable(),
});

export const zExperimentContributorList = z.array(zExperimentContributor);

/**
 * The credited faces plus the authoritative headcount, which are deliberately not the
 * same set. `contributors` is grant holders only, pseudonymised where the experiment
 * says so; `collaboratorCount` is every row the collaborators surface would show —
 * organization-derived access included — so the overview and the organization's
 * resource cards state one number rather than two under the same word.
 *
 * A count discloses nothing an identity would: it stays on this `read`-gated route
 * while naming who holds what remains `can(share)`.
 */
export const zExperimentContributors = z.object({
  contributors: zExperimentContributorList,
  collaboratorCount: z.number().int(),
});

export type ExperimentContributor = z.infer<typeof zExperimentContributor>;
export type ExperimentContributorList = z.infer<typeof zExperimentContributorList>;
export type ExperimentContributors = z.infer<typeof zExperimentContributors>;
