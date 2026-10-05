import { mainNavigation, userNavigation } from "../navigation-config";
import type { NavLink } from "../navigation-config";

export interface SectionCandidate {
  url: string;
  titleKey: string;
  namespace?: string;
  exact?: boolean;
}

/**
 * One label per sidebar destination: the top-level rows, the library children
 * (protocols/macros), and account. The header shows the section, not the page:
 * detail routes keep their section label rather than fetching a resource name.
 */
export function sectionCandidates(locale: string): SectionCandidate[] {
  const candidates: SectionCandidate[] = [];
  const entries: NavLink[] = Object.values(mainNavigation);
  for (const nav of entries) {
    if (nav.navigable === false && nav.children && nav.children.length > 0) {
      for (const child of nav.children) {
        candidates.push({
          url: child.url(locale),
          titleKey: child.titleKey,
          namespace: child.namespace,
        });
      }
    } else {
      candidates.push({
        url: nav.url(locale),
        titleKey: nav.titleKey,
        namespace: nav.namespace,
        exact: nav === mainNavigation.dashboard,
      });
    }
  }
  candidates.push({
    url: userNavigation.account.url(locale),
    titleKey: userNavigation.account.titleKey,
    namespace: userNavigation.account.namespace,
  });
  candidates.push(
    {
      url: `/${locale}/platform/experiments-archive`,
      titleKey: "experiments.archiveTitle",
      namespace: "common",
    },
    {
      url: `/${locale}/platform/transfer-request`,
      titleKey: "transferRequest.title",
      namespace: "common",
    },
    {
      url: `/${locale}/platform/notifications`,
      titleKey: "title",
      namespace: "notifications",
    },
  );
  return candidates;
}

interface HeaderLabel {
  key: string;
  namespace?: string;
}

const ACTION_LABELS: HeaderLabel[] = [
  { key: "navigation.breadcrumbs" },
  { key: "experiments.viewArchived", namespace: "experiments" },
  { key: "transferRequest.title" },
  { key: "experiments.create", namespace: "experiments" },
  { key: "protocols.create" },
  { key: "macros.create", namespace: "macro" },
  { key: "workbooks.create", namespace: "workbook" },
  { key: "iot.calibration.library.create", namespace: "iot" },
  { key: "organizations.createAction" },
  { key: "iot.devices.bulkDialog.open", namespace: "iot" },
  { key: "iot.devices.register", namespace: "iot" },
];

/** Every string the header can show, so the server translates them and the page ships no namespaces for it. */
export function headerLabels(locale: string): HeaderLabel[] {
  return [
    ...sectionCandidates(locale).map((candidate) => ({
      key: candidate.titleKey,
      namespace: candidate.namespace,
    })),
    ...ACTION_LABELS,
  ];
}

export const headerLabelKey = (key: string, namespace = "common") => `${namespace}:${key}`;
