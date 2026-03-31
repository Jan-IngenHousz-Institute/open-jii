import { isContractError, tsr } from "../../../lib/tsr";
import type { TsRestMutationOptions, TsrRoute } from "../../../lib/tsr";

export type UseMacroCreateOptions = TsRestMutationOptions<
  TsrRoute<typeof tsr.macros.createMacro>,
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
      if (!isContractError(tsr.macros.createMacro, error)) return;
      options?.onError?.(error, ...rest);
    },
  });
}
