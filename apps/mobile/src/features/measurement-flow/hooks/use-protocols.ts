import { tsr } from "~/shared/api/tsr";
import { ellipsize } from "~/shared/utils/ellipsize";
import { extractTextFromHTML } from "~/shared/utils/extract-text-from-html";

export function useProtocols() {
  const { data, isLoading, error } = tsr.protocols.listProtocols.useQuery({
    queryKey: ["protocols"],
    networkMode: "offlineFirst",
  });

  const protocols = data?.body;

  const options =
    protocols?.map((item) => ({
      value: item.id,
      label: item.name,
      description: item.description
        ? ellipsize(extractTextFromHTML(item.description), 100)
        : undefined,
      code: item.code,
    })) ?? [];

  return { protocols: options, isLoading, error };
}
