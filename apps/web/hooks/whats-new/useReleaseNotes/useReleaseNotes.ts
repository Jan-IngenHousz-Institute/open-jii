import { useQuery } from "@tanstack/react-query";

import type { ComponentReleaseNoteFieldsFragment as ReleaseNoteFields } from "@repo/cms";

function isReleaseNoteList(value: unknown): value is ReleaseNoteFields[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item: unknown) =>
        typeof item === "object" &&
        item !== null &&
        "__typename" in item &&
        item.__typename === "ComponentReleaseNote",
    )
  );
}

/** The What's new notes in one locale, from the app's own cached route. */
export const useReleaseNotes = (locale: string) => {
  return useQuery({
    queryKey: ["release-notes", locale],
    queryFn: async () => {
      const response = await fetch(`/api/release-notes?locale=${encodeURIComponent(locale)}`);

      if (!response.ok) {
        throw new Error(`Release notes request failed with ${response.status}`);
      }

      const body: unknown = await response.json();

      if (!isReleaseNoteList(body)) {
        throw new Error("Release notes response is not a list of notes");
      }

      return body;
    },
    staleTime: 5 * 60 * 1000,
  });
};
