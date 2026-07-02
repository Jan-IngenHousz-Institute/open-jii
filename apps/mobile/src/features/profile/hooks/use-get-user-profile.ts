import { useQuery } from "@tanstack/react-query";
import { orpc } from "~/shared/api/orpc";

export function useGetUserProfile(userId: string | undefined, enabled = true) {
  const { data, isLoading, error } = useQuery(
    orpc.users.getUserProfile.queryOptions({
      input: { id: userId ?? "" },
      enabled: enabled && !!userId,
      // A brand-new account hasn't created a profile yet; don't retry on 404.
      retry: (failureCount, err) => {
        if (typeof err === "object" && err !== null && "status" in err && err.status === 404) {
          return false;
        }
        return failureCount < 3;
      },
      // Greeting/profile screen fall back gracefully; don't blast the user with
      // a toast on a missing profile.
      meta: { suppressToast: true },
      networkMode: "offlineFirst",
    }),
  );

  return { userProfile: data, isLoading, error };
}
