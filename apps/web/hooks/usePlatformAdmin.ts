import { usePrincipal } from "@/components/auth/principal-context";
import { withPrincipal } from "@/hooks/principal-query-key";
import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

export function usePlatformAdmin() {
  const { userId } = usePrincipal();
  return useQuery({
    ...orpc.users.getPlatformAdminAccess.queryOptions({ input: {} }),
    queryKey: withPrincipal(orpc.users.getPlatformAdminAccess.queryKey({ input: {} }), userId),
    enabled: !!userId,
    staleTime: 0,
  });
}
