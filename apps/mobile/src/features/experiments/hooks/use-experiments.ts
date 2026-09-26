import { useQuery } from "@tanstack/react-query";
import { orpc } from "~/shared/api/orpc";
import { ellipsize } from "~/shared/utils/ellipsize";
import { extractTextFromHTML } from "~/shared/utils/extract-text-from-html";

import { listItems } from "@repo/api/shared/listing";

export function useExperiments() {
  const { data, isLoading, isPaused, error, refetch, isRefetching } = useQuery(
    orpc.experiments.listExperiments.queryOptions({
      input: { scope: "related" },
      // Explicit: prefer the persisted cache when offline so the picker
      // doesn't render an empty list while the network is unreachable.
      networkMode: "offlineFirst",
      // The list is cached/persisted across launches, so without this it only
      // refreshed on a sign-out/in. Refresh it when the picker mounts and when
      // the app returns to the foreground (focusManager → AppState) so new or
      // changed experiments show up without forcing re-auth. Cache still
      // renders instantly first thanks to offlineFirst.
      refetchOnMount: true,
      refetchOnWindowFocus: true,
    }),
  );

  // `undefined` until a response exists, which is not the same as `[]`: a cold
  // offline start pauses with no data, no error and `isLoading: false`, and the
  // picker prompt and the Home card both have to tell those two apart.
  const rows = data === undefined ? undefined : listItems(data);

  const options = listItems(data).map((item) => ({
    value: item.id,
    label: item.name,
    description: item.description
      ? ellipsize(extractTextFromHTML(item.description), 100)
      : undefined,
    fullDescription: item.description,
  }));

  return { experiments: options, rows, isLoading, isPaused, error, refetch, isRefetching };
}
