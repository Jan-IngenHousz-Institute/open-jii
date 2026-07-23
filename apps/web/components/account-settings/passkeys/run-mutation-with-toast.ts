import { toast } from "@repo/ui/hooks/use-toast";

export async function runMutationWithToast(
  mutate: () => Promise<unknown>,
  errorMessage: string,
  onSuccess?: () => void,
) {
  try {
    await mutate();
    onSuccess?.();
  } catch {
    toast({ description: errorMessage, variant: "destructive" });
  }
}
