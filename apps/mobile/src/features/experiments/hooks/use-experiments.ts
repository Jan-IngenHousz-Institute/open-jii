import { tsr } from "~/shared/api/tsr";
import { ellipsize } from "~/shared/utils/ellipsize";
import { extractTextFromHTML } from "~/shared/utils/extract-text-from-html";

export function useExperiments() {
  const { data, isLoading, error, refetch, isRefetching } =
    tsr.experiments.listExperiments.useQuery({
      queryKey: ["experiments"],
      queryData: {
        query: {
          filter: "member",
        },
      },
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
    });
  const experiments = data?.body;

  const options =
    experiments?.map((item) => ({
      value: item.id,
      label: item.name,
      description: item.description
        ? ellipsize(extractTextFromHTML(item.description), 100)
        : undefined,
      fullDescription: item.description,
    })) ?? [];

  return { experiments: options, isLoading, error, refetch, isRefetching };
}
