import { getBreadcrumbTrail } from "@/lib/breadcrumbs/getBreadcrumbTrail";
import { usePathname } from "next/navigation";
import { useMemo } from "react";

export function useBreadcrumbs(locale: string) {
  const pathname = usePathname();

  return useMemo(() => getBreadcrumbTrail(pathname, locale), [pathname, locale]);
}
