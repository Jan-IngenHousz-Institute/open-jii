import { tsr } from "~/api/tsr";

/**
 * Hardcoded Python macro for first implementation (ignores backend code when language is python).
 * Backend macro is still used for id, name, filename, etc.; only code is overridden.
 */
const HARDCODED_PYTHON_MACRO = `output = {}

output["spad"] = 2

return output
`;

function base64Encode(str: string): string {
  return btoa(unescape(encodeURIComponent(str)));
}

export function useMacro(macroId: string | undefined) {
  const { data, isLoading, error } = tsr.macros.getMacro.useQuery({
    queryKey: ["macro", macroId],
    queryData: { params: { id: macroId ?? "" } },
    enabled: !!macroId,
    networkMode: "offlineFirst",
  });

  let macro = data?.body;

  // if (macro) {
  //   macro.language = "python";
  // }
  if (macro?.language === "python") {
    macro = { ...macro, code: base64Encode(HARDCODED_PYTHON_MACRO) };
  }

  return {
    macro,
    isLoading,
    error,
  };
}
