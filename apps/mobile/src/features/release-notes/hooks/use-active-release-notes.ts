import { useQuery } from "@tanstack/react-query";
import { fetchActiveReleaseNotes } from "~/features/release-notes/services/fetch-active-release-notes";
import { useEnvironmentStore } from "~/shared/stores/environment-store";

import type { ComponentReleaseNoteFieldsFragment as ReleaseNoteFields } from "@repo/cms/lib/__generated/sdk";

const FIVE_MINUTES = 5 * 60 * 1000;

/** Active mobile release notes from Contentful, cached 5 min (mirrors useActiveAlerts). */
export function useActiveReleaseNotes(locale = "en-US"): ReleaseNoteFields[] {
  const envLoaded = useEnvironmentStore((s) => s.isLoaded);

  const { data } = useQuery({
    queryKey: ["contentful", "release-notes", locale],
    queryFn: () => fetchActiveReleaseNotes(locale),
    enabled: envLoaded,
    staleTime: FIVE_MINUTES,
    gcTime: FIVE_MINUTES,
    refetchOnMount: true,
  });

  return data ?? [];
}
