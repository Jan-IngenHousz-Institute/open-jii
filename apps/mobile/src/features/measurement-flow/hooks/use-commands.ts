import { tsr } from "~/shared/api/tsr";
import { ellipsize } from "~/shared/utils/ellipsize";
import { extractTextFromHTML } from "~/shared/utils/extract-text-from-html";

export function useCommands() {
  const { data, isLoading, error } = tsr.commands.listCommands.useQuery({
    queryKey: ["commands"],
    networkMode: "offlineFirst",
  });

  const commands = data?.body;

  const options =
    commands?.map((item) => ({
      value: item.id,
      label: item.name,
      description: item.description
        ? ellipsize(extractTextFromHTML(item.description), 100)
        : undefined,
      code: item.code,
    })) ?? [];

  return { commands: options, isLoading, error };
}
