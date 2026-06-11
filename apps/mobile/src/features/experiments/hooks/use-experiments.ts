import { contentKeys } from "~/shared/api/content-query-keys";
import { tsr } from "~/shared/api/tsr";
import { ellipsize } from "~/shared/utils/ellipsize";
import { extractTextFromHTML } from "~/shared/utils/extract-text-from-html";

export function useExperiments() {
  const { data, isLoading, error } = tsr.experiments.listExperiments.useQuery({
    queryKey: contentKeys.experiments,
    queryData: {
      query: {
        filter: "member",
      },
    },
    // Explicit: prefer the persisted cache when offline so the picker
    // doesn't render an empty list while the network is unreachable.
    networkMode: "offlineFirst",
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

  return { experiments: options, isLoading, error };
}
