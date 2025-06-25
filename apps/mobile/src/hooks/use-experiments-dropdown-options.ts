import { tsr } from "~/api/tsr";
import { DropdownOption } from "~/components/Dropdown";
import { mockExperiments } from "~/mocks/mock-experiments";

function realUseExperimentsDropdownOptions() {
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

function mockUseExperimentsDropdownOptions() {
  const options: DropdownOption[] = mockExperiments.map((item) => ({
    value: item.value,
    label: item.label,
    description: item.description ?? undefined,
  }));

  return { options, isLoading: false, error: undefined };
}

export const useExperimentsDropdownOptions =
  process.env.MOCK_BACKEND === "true"
    ? mockUseExperimentsDropdownOptions
    : realUseExperimentsDropdownOptions;
