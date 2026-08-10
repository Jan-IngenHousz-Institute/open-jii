"use client";

import { useLocale } from "@/hooks/useLocale";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useTranslation } from "@repo/i18n";
import { NavTabs, NavTabsList, NavTabsTrigger } from "@repo/ui/components/nav-tabs";

/**
 * Placeholder tabs are real routes too, keeping direct links and browser history
 * consistent instead of mixing navigation with local tab state.
 */
const DEVICE_TABS = [
  { value: "overview", segment: "" },
  { value: "credentials", segment: "credentials" },
  { value: "onboarding", segment: "onboarding" },
  { value: "collaborators", segment: "collaborators" },
  { value: "lineage", segment: "lineage" },
  { value: "monitoring", segment: "monitoring" },
] as const;

interface IotDeviceDetailTabsProps {
  deviceId: string;
  /** Hides a Collaborators route that would immediately redirect without share/leave access. */
  canShare: boolean;
  /** `capabilities.canLeave`: the caller holds a direct grant they could give up. */
  canLeave: boolean;
  /** Gates real AWS certificate issue/rotate/revoke controls that require `manage`. */
  canManage: boolean;
  children: React.ReactNode;
}

/**
 * Routes let each tab own its entire surface, so credentials and danger-zone
 * controls are absent—not merely hidden—elsewhere, while links/back still work.
 */
export function IotDeviceDetailTabs({
  deviceId,
  canShare,
  canLeave,
  canManage,
  children,
}: IotDeviceDetailTabsProps) {
  const { t } = useTranslation("iot");
  const pathname = usePathname();
  const locale = useLocale();

  const basePath = `/${locale}/platform/devices/${deviceId}`;
  const tabs = DEVICE_TABS.filter((tab) => {
    if (tab.value === "collaborators") return canShare || canLeave;
    if (tab.value === "credentials") return canManage;
    return true;
  });
  // Match all routes first so a filtered-out tab does not highlight Overview.
  const urlTab = DEVICE_TABS.find(
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
