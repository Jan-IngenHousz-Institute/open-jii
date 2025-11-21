import { useQuery } from "@tanstack/react-query";
import { isOnline } from "~/utils/is-online";

export function useIsOnline() {
  return useQuery({
    queryKey: ["is-online"],
    queryFn: isOnline,
    refetchInterval: 2000,
    staleTime: 0,
  });
}
