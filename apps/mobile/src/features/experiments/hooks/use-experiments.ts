import { tsr } from "~/shared/api/tsr";
import { ellipsize } from "~/shared/utils/ellipsize";
import { extractTextFromHTML } from "~/shared/utils/extract-text-from-html";

export function useExperiments() {
  const { data, isLoading, error } = tsr.experiments.listExperiments.useQuery({
    queryKey: ["experiments"],
    queryData: {
      query: {
        filter: "member",
      },
    },
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
