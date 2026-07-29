import { z } from "zod";

/**
 * A person credited as a contributor on an experiment: someone who holds a grant
 * on it, and can therefore add measurements and annotations.
 *
 * Deliberately narrower than the collaborators list the sharing routes return —
 * no email and no tier. This is the public-facing credit, readable by anyone who
 * can read the experiment, whereas enumerating who holds *what* access requires
 * `can(share)`.
 *
 * On an experiment that anonymizes its contributors, every field here is the
 * pseudonym the measurement rows already carry instead of the real identity.
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

export type ExperimentContributor = z.infer<typeof zExperimentContributor>;
export type ExperimentContributorList = z.infer<typeof zExperimentContributorList>;
