import { tsr } from "@/lib/tsr";

/**
 * Hook to get current user
 *
 * @param userId The ID of the current user for authentication
 * @returns Query result containing the user
 */
export const useGetUser = (userId: string) => {
  return tsr.users.getUser.useQuery({
    queryData: { params: { id: userId } },
    queryKey: ["user", userId],
  });
};
