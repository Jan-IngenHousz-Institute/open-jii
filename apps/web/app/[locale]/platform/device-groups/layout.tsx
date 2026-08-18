"use client";

import { PageContainer } from "@/components/page-container";
import { useFeatureFlagEnabled } from "@/hooks/useFeatureFlag";
import { notFound } from "next/navigation";

import { FEATURE_FLAGS } from "@repo/analytics";

/**
 * Every route here is a group detail; the group list lives on the devices page.
 * Same container and flag gate as the devices section, so both details align.
 */
export default function DeviceGroupsLayout({ children }: { children: React.ReactNode }) {
  // undefined while flags load; render nothing to avoid flashing a gated page
  const devicesEnabled = useFeatureFlagEnabled(FEATURE_FLAGS.IOT_DEVICES);
  if (devicesEnabled === false) notFound();
  if (!devicesEnabled) return null;

  return (
    <PageContainer width="fluid" className="space-y-6">
      {children}
    </PageContainer>
  );
}
