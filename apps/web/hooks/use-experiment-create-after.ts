import { tsrWithToasts } from "@/lib/tsr-with-toasts";

import { toast } from "@repo/ui/hooks";

/**
 * AFTER: Automatic error toast handling
 * This example shows how to migrate from manual error handling to automatic toast notifications
 */
export const useExperimentCreate = () => {
  const queryClient = tsrWithToasts.useQueryClient();

  return tsrWithToasts.experiments.create.useMutation({
    onMutate: () => {
      // Optimistic updates (unchanged)
    },
    onSuccess: (data) => {
      // Invalidate queries (unchanged)
      queryClient.invalidateQueries({ queryKey: ["experiments"] });

      // Success notification (unchanged)
      toast({
        variant: "default",
        title: "Success",
        description: "Experiment created successfully",
      });
    },
    onError: (error) => {
      // Only need additional error handling beyond toast notifications
      // The error toast is now handled automatically!

      // For example:
      // - Reset form state
      // - Log to analytics
      // - Handle specific error cases with custom logic
      console.error(
        "Additional handling for experiment creation error:",
        error,
      );
    },
  });
};
