"use client";

import { useLocale } from "@/hooks/useLocale";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useTranslation } from "@repo/i18n";
import { NavTabs, NavTabsList, NavTabsTrigger } from "@repo/ui/components/nav-tabs";

/**
 * The tabs of a device, in strip order. Each is a route segment under
 * `devices/{deviceId}`, with the overview living at the bare detail path.
 *
 * The three placeholders are routes too, not in-page panels: a strip where some
 * tabs navigate and others swap local state behaves differently under the back
 * button depending on which one you clicked, which is worse than either choice
 * made consistently.
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
  /**
   * `capabilities.canShare` from the device response. Without it — and without a
   * grant of their own — a reader has nothing to manage, so the tab is hidden
   * rather than leading to a route that redirects straight back.
   */
  canShare: boolean;
  /** `capabilities.canLeave`: the caller holds a direct grant they could give up. */
  canLeave: boolean;
  /**
   * `capabilities.canManage`. Gates the Credentials tab: every action on it
   * issues, rotates or revokes a real AWS certificate and is refused below
   * `manage`, so offering the tab to somebody shared the device "Can view" would
   * only lead them to buttons that 403.
   */
  canManage: boolean;
  children: React.ReactNode;
}

/**
 * The route-linked strip on a device's detail page, sitting in the layout under
 * the title — the shape every other resource type has.
 *
 * Being routes rather than in-page tab state is what makes each tab a place: the
 * credentials card and the danger zone belong to their own routes, so switching to
 * Collaborators simply does not render them, and the surface is linkable with a
 * working back button.
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
  // Read off the URL rather than kept in state: the route is the source of truth,
  // so a direct visit and the back button both land on the right tab.
  //
  // Matched against every tab, not only the visible ones, and then checked against
  // what is actually on screen. Matching the visible subset would resolve a
  // filtered-out segment to `"overview"` — so somebody whose access was reduced
  // while sitting on `/credentials` would see Overview highlighted while the URL
  // still said `/credentials`. Falling through to `""` selects nothing, which is
  // the honest answer: the route they are on has no tab any more. The routes
  // themselves redirect, so this state lasts a frame.
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
