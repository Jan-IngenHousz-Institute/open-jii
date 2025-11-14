import { tsr } from "~/api/tsr";
import { ellipsize } from "~/utils/ellipsize";
import { extractTextFromHTML } from "~/utils/extract-text-from-html";

export function useProtocols() {
  const { data, isLoading, error } = tsr.protocols.listProtocols.useQuery({
    queryKey: ["protocols"],
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
