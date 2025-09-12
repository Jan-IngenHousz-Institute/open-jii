import { tsr } from "../../../lib/tsr";

interface UseMacroCreateOptions {
  onSuccess?: (id: string) => void;
  onError?: (error: Error) => void;
}

export function useMacroCreate(options?: UseMacroCreateOptions) {
  const queryClient = tsr.useQueryClient();

  return tsr.macros.createMacro.useMutation({
    onSuccess: (result) => {
      // Invalidate and refetch macros list
      void queryClient.invalidateQueries({ queryKey: ["macros"] });
      options?.onSuccess?.(result.body.id);
    },
    onError: (error) => {
      options?.onError?.(error as Error);
    },
  });
}
