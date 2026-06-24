export interface BreadcrumbSegment {
  segment: string;
  title: string;
  href: string;
}

const ENTITY_PARENTS = new Set([
  "experiments",
  "experiments-archive",
  "macros",
  "protocols",
  "workbooks",
]);

function isEntityId(segments: string[], index: number): boolean {
  return index > 0 && ENTITY_PARENTS.has(segments[index - 1]);
}

// Ancestor trail for a platform pathname, excluding the current page (whose
// title is shown in the page header row below the breadcrumb).
export function getBreadcrumbTrail(pathname: string, locale: string): BreadcrumbSegment[] {
  const segments = pathname.split("/").filter(Boolean).slice(2);
  if (segments.length === 0) return [];

  // Stop at the first entity ID so deep tab/sub routes don't add crumbs.
  let end = segments.length;
  for (let i = 0; i < segments.length; i++) {
    if (isEntityId(segments, i)) {
      end = i + 1;
      break;
    }
  }

  const trail = segments.slice(0, end - 1);
  return trail.map((segment, i) => ({
    segment,
    title: segment,
    href: `/${locale}/platform/${trail.slice(0, i + 1).join("/")}`,
  }));
}
