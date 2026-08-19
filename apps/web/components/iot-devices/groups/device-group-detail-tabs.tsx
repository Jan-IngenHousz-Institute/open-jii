"use client";

import { useLocale } from "@/hooks/useLocale";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useTranslation } from "@repo/i18n";
import { NavTabs, NavTabsList, NavTabsTrigger } from "@repo/ui/components/nav-tabs";

// Mirrors the device tab strip; lineage is absent because a group has no
// identity-to-measurement trace of its own. Placeholder tabs are real routes,
// keeping links and history consistent.
const GROUP_TABS = [
  { value: "overview", segment: "" },
  { value: "credentials", segment: "credentials" },
  { value: "onboarding", segment: "onboarding" },
  { value: "collaborators", segment: "collaborators" },
  { value: "monitoring", segment: "monitoring" },
] as const;

interface DeviceGroupDetailTabsProps {
  groupId: string;
  /** Hides a Collaborators route that would immediately redirect without share/leave access. */
  canShare: boolean;
  canLeave: boolean;
  /** Gates the bulk credential lifecycle, which requires `manage`. */
  canManage: boolean;
  children: React.ReactNode;
}

export function DeviceGroupDetailTabs({
  groupId,
  canShare,
  canLeave,
  canManage,
  children,
}: DeviceGroupDetailTabsProps) {
  const { t } = useTranslation("iot");
  const pathname = usePathname();
  const locale = useLocale();

  const basePath = `/${locale}/platform/devices/groups/${groupId}`;
  const tabs = GROUP_TABS.filter((tab) => {
    if (tab.value === "collaborators") return canShare || canLeave;
    if (tab.value === "credentials") return canManage;
    return true;
  });
  // Match all routes first so a filtered-out tab does not highlight Overview.
  const urlTab = GROUP_TABS.find(
    (tab) => tab.segment !== "" && pathname.endsWith(`/${tab.segment}`),
  );
  const activeTab = urlTab
    ? tabs.some((tab) => tab.value === urlTab.value)
      ? urlTab.value
      : ""
    : "overview";

  return (
    <NavTabs value={activeTab} className="mt-8 flex w-full flex-1 flex-col">
      <NavTabsList>
        {tabs.map((tab) => (
          <NavTabsTrigger key={tab.value} value={tab.value} asChild>
            <Link href={tab.segment ? `${basePath}/${tab.segment}` : basePath}>
              {t(`iot.devices.detailTabs.${tab.value}`)}
            </Link>
          </NavTabsTrigger>
        ))}
      </NavTabsList>

      <div className="mt-6 flex flex-1 flex-col">{children}</div>
    </NavTabs>
  );
}
