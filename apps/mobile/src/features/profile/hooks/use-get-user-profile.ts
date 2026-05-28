import { tsr } from "~/shared/api/tsr";

export function useGetUserProfile(userId: string | undefined, enabled = true) {
  const { data, isLoading, error } = tsr.users.getUserProfile.useQuery({
    queryKey: ["userProfile", userId],
    queryData: { params: { id: userId ?? "" } },
    enabled: enabled && !!userId,
    // A brand-new account hasn't created a profile yet; don't retry on 404.
    retry: (failureCount, err) => {
      if (typeof err === "object" && err !== null && "status" in err && err.status === 404) {
        return false;
      }
      return failureCount < 3;
    },
  });

  return { userProfile: data?.body, isLoading, error };
}
