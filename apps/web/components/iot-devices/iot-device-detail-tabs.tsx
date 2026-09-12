"use client";

import { WorkspaceBand } from "@/components/workspace-band";
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
  { value: "firmware", segment: "firmware" },
  { value: "collaborators", segment: "collaborators" },
  { value: "lineage", segment: "lineage" },
  { value: "monitoring", segment: "monitoring" },
] as const;

type DeviceTabValue = (typeof DEVICE_TABS)[number]["value"];

interface IotDeviceDetailTabsProps {
  deviceId: string;
  /** Phones have no certificate lifecycle and no config to deliver. */
  isMobileFamily: boolean;
  /** Only families whose firmware JII builds have a release line to show. */
  hasManagedFirmware: boolean;
  /** `capabilities.canShare`: the caller may grant others access. */
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
 *
 * A tab the device has no use for is dropped; a tab the viewer simply may not
 * open stays visible and disabled, so the device reads the same to everyone and
 * missing permission looks like missing permission rather than a missing feature.
 */
export function IotDeviceDetailTabs({
  deviceId,
  isMobileFamily,
  hasManagedFirmware,
  canShare,
  canLeave,
  canManage,
  children,
}: IotDeviceDetailTabsProps) {
  const { t } = useTranslation("iot");
  const pathname = usePathname();
  const locale = useLocale();

  const basePath = `/${locale}/platform/devices/${deviceId}`;

  function isSupported(value: DeviceTabValue): boolean {
    if (value === "credentials" || value === "onboarding") {
      return !isMobileFamily;
    }
    if (value === "firmware") {
      return hasManagedFirmware;
    }
    return true;
  }

  function isPermitted(value: DeviceTabValue): boolean {
    if (value === "collaborators") {
      return canShare || canLeave;
    }
    if (value === "credentials" || value === "onboarding") {
      return canManage;
    }
    return true;
  }

  const tabs = DEVICE_TABS.filter((tab) => isSupported(tab.value));
  const urlTab = DEVICE_TABS.find(
    (tab) => tab.segment !== "" && pathname.endsWith(`/${tab.segment}`),
  );
  const activeTab = urlTab
    ? tabs.some((tab) => tab.value === urlTab.value)
      ? urlTab.value
      : ""
    : "overview";

  function renderTab(tab: (typeof DEVICE_TABS)[number]) {
    const label = t(`iot.devices.detailTabs.${tab.value}`);

    if (!isPermitted(tab.value)) {
      return (
        <NavTabsTrigger key={tab.value} value={tab.value} disabled>
          {label}
        </NavTabsTrigger>
      );
    }

    return (
      <NavTabsTrigger key={tab.value} value={tab.value} asChild>
        <Link href={tab.segment ? `${basePath}/${tab.segment}` : basePath}>{label}</Link>
      </NavTabsTrigger>
    );
  }

  return (
    <NavTabs value={activeTab} className="mt-8 flex w-full min-w-0 flex-1 flex-col">
      <NavTabsList>{tabs.map(renderTab)}</NavTabsList>

      <WorkspaceBand className="mt-6">{children}</WorkspaceBand>
    </NavTabs>
  );
}
