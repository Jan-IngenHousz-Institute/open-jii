import { toast } from "@repo/ui/hooks/use-toast";

export async function runMutationWithToast(
  mutate: () => Promise<unknown>,
  errorMessage: string | ((error: unknown) => string),
  onSuccess?: () => void,
) {
  try {
    await mutate();
    onSuccess?.();
  } catch (error) {
    const description = typeof errorMessage === "string" ? errorMessage : errorMessage(error);
    toast({ description, variant: "destructive" });
  }
}
