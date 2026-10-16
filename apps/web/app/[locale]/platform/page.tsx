import { ActivitySection } from "@/components/dashboard/activity-section";
import { BlogPostsSection } from "@/components/dashboard/blog-posts-section";
import {
  UNREAD_NOTIFICATIONS_INPUT,
  homeExperimentsQuery,
  publicExperimentsQuery,
  recentlyOpenedQuery,
} from "@/components/dashboard/dashboard-queries";
import { FeedbackLinks } from "@/components/dashboard/feedback-links";
import { GetStartedSection } from "@/components/dashboard/get-started-section";
import { HomeLayout } from "@/components/dashboard/home-layout";
import type { HomeSection } from "@/components/dashboard/home-layout";
import { HomeNotice } from "@/components/dashboard/home-notice";
import { NotificationsSection } from "@/components/dashboard/notifications-section";
import { PublicResearchSection } from "@/components/dashboard/public-research-section";
import { RecentlyOpenedSection } from "@/components/dashboard/recently-opened-section";
import { WhatsNewSection } from "@/components/dashboard/whats-new-section";
import type { WhatsNewEntry } from "@/components/dashboard/whats-new-section";
import { PrefetchedQueries } from "@/components/server-prefetch/prefetched-queries";
import { fetchWebReleaseNotes } from "@/components/whats-new/fetch-release-notes";
import { notificationsListQuery } from "@/hooks/notifications/useNotifications/notifications-list-query";
import { unreadCountQuery } from "@/hooks/notifications/useUnreadNotificationCount/unread-count-query";
import type { Metadata } from "next";
import { auth } from "~/app/actions/auth";

import initTranslations from "@repo/i18n/server";

const WHATS_NEW_ENTRIES = 2;

interface PlatformPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PlatformPageProps): Promise<Metadata> {
  const { locale } = await params;
  const { t } = await initTranslations({ locale, namespaces: ["dashboard"] });

  return { title: t("title") };
}

/**
 * The researcher's home: what they opened and what is waiting for them first, then public
 * research. The list below is the one-column order; each entry names its column in two.
 */
export default async function PlatformHome({ params }: PlatformPageProps) {
  const { locale } = await params;
  const [session, releaseNotes] = await Promise.all([auth(), fetchWebReleaseNotes(locale)]);
  const userId = session?.user.id;

  const whatsNew: WhatsNewEntry[] = releaseNotes
    .flatMap((note) =>
      note.title && typeof note.publishedAt === "string"
        ? [{ id: note.sys.id, title: note.title, publishedAt: note.publishedAt }]
        : [],
    )
    .slice(0, WHATS_NEW_ENTRIES);

  const sections: HomeSection[] = [
    { key: "notifications", column: "rail", node: <NotificationsSection /> },
    { key: "recently-opened", column: "main", node: <RecentlyOpenedSection /> },
    { key: "public-research", column: "main", node: <PublicResearchSection /> },
    { key: "blog-posts", column: "main", node: <BlogPostsSection locale={locale} /> },
    { key: "last-30-days", column: "rail", node: <ActivitySection locale={locale} /> },
    {
      key: "whats-new",
      column: "rail",
      node: <WhatsNewSection entries={whatsNew} locale={locale} />,
    },
    { key: "feedback", column: "rail", node: <FeedbackLinks /> },
  ];

  return (
    <PrefetchedQueries
      queries={(utils) => [
        recentlyOpenedQuery(utils),
        homeExperimentsQuery(utils),
        publicExperimentsQuery(utils),
        notificationsListQuery(utils, userId, UNREAD_NOTIFICATIONS_INPUT),
        unreadCountQuery(utils, userId),
      ]}
    >
      <div className="flex flex-col gap-6">
        <HomeNotice locale={locale} />
        <GetStartedSection />
        <HomeLayout sections={sections} />
      </div>
    </PrefetchedQueries>
  );
}
