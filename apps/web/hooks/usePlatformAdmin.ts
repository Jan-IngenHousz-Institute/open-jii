import { usePrincipal } from "@/components/auth/principal-context";
import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

export function usePlatformAdmin() {
  const { userId } = usePrincipal();
  return useQuery({
    ...orpc.users.getPlatformAdminAccess.queryOptions({ input: {} }),
    queryKey: ["platform-admin-access", userId],
    enabled: !!userId,
    staleTime: 0,
  });
}
