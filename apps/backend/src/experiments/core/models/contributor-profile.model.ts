/** A contributor's profile as every page shows it: "Unknown User" once they deactivate it. */
export interface ContributorProfile {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
}
