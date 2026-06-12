import { enrichPathSegments } from "@/shared/api/breadcrumbs";
import { useQuery } from "@tanstack/react-query";
import { usePathname } from "next/navigation";

export function useBreadcrumbs(locale: string) {
  const pathname = usePathname();

  return useQuery({
    queryKey: ["breadcrumbs", pathname, locale],
    queryFn: () => enrichPathSegments(pathname, locale),
  });
}
