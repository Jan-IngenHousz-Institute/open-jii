import { useQuery } from "@tanstack/react-query";
import { isOnline } from "~/shared/device/is-online";

interface UseIsOnlineOptions {
  // Report offline only after two misses in a row, and drop the result on unmount.
  confirm?: boolean;
}

const confirmedIsOnline = async () => (await isOnline()) || (await isOnline());

export function useIsOnline({ confirm = false }: UseIsOnlineOptions = {}) {
  return useQuery({
    queryKey: confirm ? ["is-online", "confirmed"] : ["is-online"],
    queryFn: confirm ? confirmedIsOnline : isOnline,
    refetchInterval: 2000,
    staleTime: 0,
    ...(confirm ? { gcTime: 0 } : {}),
    networkMode: "always",
  });
}
