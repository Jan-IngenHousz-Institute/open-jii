import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "~/features/auth/hooks/use-session";

export function useLogout() {
  const queryClient = useQueryClient();
  const { signOut } = useSession();

  return async () => {
    // Sign out first so the navigator swaps to the (theme-painted) login
    // screen right away; reset the cache afterwards so that heavy work isn't
    // competing with the login screen's first render — that competition is
    // what left the screen blank for a beat on logout.
    await signOut();
    queryClient.resetQueries();
  };
}
