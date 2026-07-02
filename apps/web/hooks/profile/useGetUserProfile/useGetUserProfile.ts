import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

export const useGetUserProfile = (userId: string, enabled = true) => {
  return useQuery(
    orpc.users.getUserProfile.queryOptions({
      input: { id: userId },
      enabled: enabled && !!userId,
      retry: (failureCount, error) => {
        // Don't retry on 404 Not Found - user profile doesn't exist yet
        if (typeof error === "object" && "status" in error && error.status === 404) {
          return false;
        }
        // Use default retry logic for other errors (up to 3 times)
        return failureCount < 3;
      },
    }),
  );
};
