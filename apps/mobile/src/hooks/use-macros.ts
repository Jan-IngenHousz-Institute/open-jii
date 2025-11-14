import { tsr } from "~/api/tsr";
import { ellipsize } from "~/utils/ellipsize";
import { extractTextFromHTML } from "~/utils/extract-text-from-html";

export function useMacros() {
  const { data, isLoading, error } = tsr.macros.listMacros.useQuery({
    queryKey: ["macros"],
  });

  const macros = data?.body;

  const options =
    macros?.map((item) => ({
      value: item.id,
      label: item.name,
      description: item.description
        ? ellipsize(extractTextFromHTML(item.description), 100)
        : undefined,
      filename: item.filename,
      code: item.code,
    })) ?? [];

  return { macros: options, isLoading, error };
}
