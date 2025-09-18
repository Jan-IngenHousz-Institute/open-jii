import { tsr } from "~/api/tsr";
import { DropdownOption } from "~/components/Dropdown";
import { ellipsize } from "~/utils/ellipsize";
import { extractTextFromHTML } from "~/utils/extract-text-from-html";

export function useExperimentsDropdownOptions() {
  const { data, isLoading, error } = tsr.experiments.listExperiments.useQuery({
    queryKey: ["experiments"],
    queryData: {
      query: {
        filter: "related",
      },
    },
  });
  const experiments = data?.body;

  const options: DropdownOption[] =
    experiments?.map((item) => ({
      value: item.id,
      label: item.name,
      description: item.description
        ? ellipsize(extractTextFromHTML(item.description), 100)
        : undefined,
    })) ?? [];

  return { options, isLoading, error };
}
