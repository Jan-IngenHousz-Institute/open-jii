import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "~/features/auth/hooks/use-session";

export function useLogout() {
  const queryClient = useQueryClient();
  const { signOut } = useSession();

  return async () => {
    queryClient.resetQueries();
    await signOut();
  };
}
