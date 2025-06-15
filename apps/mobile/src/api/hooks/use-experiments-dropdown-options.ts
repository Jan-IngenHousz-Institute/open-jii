import { tsr } from "~/api/tsr";
import { DropdownOption } from "~/components/Dropdown";

export function useExperimentsDropdownOptions() {
  const { data, isLoading, error } = tsr.experiments.listExperiments.useQuery({
    queryKey: ["experiments"],
  });
  const experiments = data?.body;

  const options: DropdownOption[] =
    experiments?.map((item) => ({
      value: item.id,
      label: item.name,
      description: item.description ?? undefined,
    })) ?? [];

  return { options, isLoading, error };
}
