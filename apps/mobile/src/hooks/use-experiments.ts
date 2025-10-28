import { tsr } from "~/api/tsr";
import { ellipsize } from "~/utils/ellipsize";
import { extractTextFromHTML } from "~/utils/extract-text-from-html";

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
      fullDescription: item.description ? extractTextFromHTML(item.description) : undefined,
    })) ?? [];

  return { experiments: options, isLoading, error };
}
