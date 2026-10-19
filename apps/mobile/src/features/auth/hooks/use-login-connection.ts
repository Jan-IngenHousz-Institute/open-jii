import { useQuery } from "@tanstack/react-query";
import { isOnline } from "~/shared/device/is-online";

export function useLoginConnection() {
  return useQuery({
    queryKey: ["login-connection"],
    queryFn: async () => (await isOnline()) || (await isOnline()),
    refetchInterval: 2000,
    staleTime: 0,
    gcTime: 0,
    networkMode: "always",
  });
}
