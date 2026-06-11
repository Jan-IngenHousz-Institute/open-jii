import { useQuery } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { enrichPathSegments } from "~/app/actions/breadcrumbs";

export function useBreadcrumbs(locale: string) {
  const pathname = usePathname();

  return useQuery({
    queryKey: ["breadcrumbs", pathname, locale],
    queryFn: () => enrichPathSegments(pathname, locale),
  });
}
