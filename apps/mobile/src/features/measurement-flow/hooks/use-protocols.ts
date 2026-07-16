import { useQuery } from "@tanstack/react-query";
import { orpc } from "~/shared/api/orpc";
import { ellipsize } from "~/shared/utils/ellipsize";
import { extractTextFromHTML } from "~/shared/utils/extract-text-from-html";

export function useProtocols() {
  const { data, isLoading, error } = useQuery(
    orpc.protocols.listProtocols.queryOptions({
      input: {},
      networkMode: "offlineFirst",
    }),
  );

  const options =
    data?.map((item) => ({
      value: item.id,
      label: item.name,
      description: item.description
        ? ellipsize(extractTextFromHTML(item.description), 100)
        : undefined,
      code: item.code,
    })) ?? [];

  return { protocols: options, isLoading, error };
}
