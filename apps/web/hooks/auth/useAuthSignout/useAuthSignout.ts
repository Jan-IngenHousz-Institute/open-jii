import { tsr } from "../../../lib/tsr";

/**
 * Hook to signout the current user
 * @returns Mutation object for signing out
 */
export const useAuthSignout = () => {
  return tsr.auth.signOut.useMutation({
    onSuccess: () => {
      // Redirect to the home page after signout
      window.location.href = "/";
    },
  });
};
