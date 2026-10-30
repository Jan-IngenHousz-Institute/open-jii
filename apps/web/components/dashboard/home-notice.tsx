"use client";

import { guestMayUse } from "@/components/auth/guest-access";
import { useIsGuest } from "@/components/auth/principal-context";
import { usePublicMetrics } from "@/hooks/metrics/usePublicMetrics/usePublicMetrics";
import { useRememberedValue } from "@/hooks/useRememberedValue";

import type { MetricsCaption } from "@repo/api/domains/metrics/metrics.schema";

import { MilestoneNotice } from "./milestone-notice";
import { WelcomeNotice } from "./welcome-notice";

const isMilestone = (
  caption: MetricsCaption,
): caption is Extract<MetricsCaption, { kind: "milestone" }> => caption.kind === "milestone";

// A milestone stands for months, so dismissal outlives the mount. Keyed by the
// milestone itself: the next one is news again.
const MILESTONE_DISMISSED_KEY = "openjii.milestone.dismissed";
const WELCOME_DISMISSED_KEY = "openjii.welcome.dismissed";

interface HomeNoticeProps {
  locale: string;
}

/** At most one notice: a standing milestone first, then the welcome, each until dismissed. */
export function HomeNotice({ locale }: HomeNoticeProps) {
  const { data, isPending } = usePublicMetrics();
  const milestoneDismissal = useRememberedValue(MILESTONE_DISMISSED_KEY);
  const welcomeDismissal = useRememberedValue(WELCOME_DISMISSED_KEY);
  // The welcome is an invitation to transfer data, which a guest cannot request.
  const mayTransfer = guestMayUse("experiments.createTransferRequest", useIsGuest());

  // Neither shows before hydration, so a dismissed notice never flashes, nor while the
  // metrics load, so the welcome is never swapped for a milestone under the reader's cursor.
  if (!welcomeDismissal.isHydrated || isPending) {
    return null;
  }

  const milestone = data?.captions.find(isMilestone);

  if (milestone !== undefined && String(milestone.ordinal) !== milestoneDismissal.value) {
    const dismissMilestone = () => milestoneDismissal.remember(String(milestone.ordinal));
    return <MilestoneNotice milestone={milestone} locale={locale} onDismiss={dismissMilestone} />;
  }

  if (welcomeDismissal.value === null && mayTransfer) {
    const dismissWelcome = () => welcomeDismissal.remember("true");
    return <WelcomeNotice locale={locale} onDismiss={dismissWelcome} />;
  }

  return null;
}
