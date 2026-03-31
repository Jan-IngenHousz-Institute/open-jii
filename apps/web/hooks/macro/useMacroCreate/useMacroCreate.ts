import { contract, isContractError, tsr } from "../../../lib/tsr";
import type { TsRestMutationOptions } from "../../../lib/tsr";

export type UseMacroCreateOptions = TsRestMutationOptions<
  typeof contract.macros.createMacro,
  "onSuccess" | "onError"
>;

export function useMacroCreate(options?: UseMacroCreateOptions) {
  const queryClient = tsr.useQueryClient();

  return tsr.macros.createMacro.useMutation({
    onSuccess: (...args) => {
      void queryClient.invalidateQueries({ queryKey: ["macros"] });
      options?.onSuccess?.(...args);
    },
    onError: (error, ...rest) => {
      if (!isContractError(contract.macros.createMacro, error)) return;
      options?.onError?.(error, ...rest);
    },
  });
}
