import { isContractError, tsr } from "../../../lib/tsr";
import type { TsRestMutationOptions, TsrRoute } from "../../../lib/tsr";

const route = tsr.macros.createMacro;

export type UseMacroCreateOptions = TsRestMutationOptions<
  TsrRoute<typeof route>,
  "onSuccess" | "onError"
>;

export function useMacroCreate(options?: UseMacroCreateOptions) {
  const queryClient = tsr.useQueryClient();

  return route.useMutation({
    onSuccess: (...args) => {
      void queryClient.invalidateQueries({ queryKey: ["macros"] });
      options?.onSuccess?.(...args);
    },
    onError: (error, ...rest) => {
      if (!isContractError(error)) return;
      options?.onError?.(error, ...rest);
    },
  });
}
