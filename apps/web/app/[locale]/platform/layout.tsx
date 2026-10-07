import { ActivityProvider } from "@/components/activity/activity-context";
import { PasskeyCreatePrompt } from "@/components/auth/passkey-create-prompt";
import { PrincipalProvider } from "@/components/auth/principal-context";
import { CalibrationFlagProvider } from "@/components/calibrations/calibration-flag-context";
import { CommandPalette } from "@/components/command/command-palette";
import { NavigationSidebarWrapper } from "@/components/navigation/navigation-sidebar-wrapper/navigation-sidebar-wrapper";
import { PlatformHeaderProvider } from "@/components/navigation/site-header/platform-header-context";
import { SiteHeaderWrapper } from "@/components/navigation/site-header/site-header-wrapper";
import { PageContainer } from "@/components/page-container";
import { ShortcutHint } from "@/components/shortcuts/shortcut-hint";
import { ShortcutsRoot } from "@/components/shortcuts/shortcuts-root";
import { TranslationBundles } from "@/components/translation-bundles";
import { fetchWebReleaseNotes } from "@/components/whats-new/fetch-release-notes";
import { WhatsNewSheet } from "@/components/whats-new/whats-new-sheet";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type React from "react";
import { Suspense } from "react";
import { auth } from "~/app/actions/auth";
import { isFeatureFlagEnabledForSession } from "~/lib/posthog-server";

import { FEATURE_FLAGS } from "@repo/analytics";
import type { Namespace } from "@repo/i18n";
import { namespaces } from "@repo/i18n/config";
import { loadNamespaceBundles } from "@repo/i18n/server";
import { SidebarEdgePeek, SidebarInset, SidebarProvider } from "@repo/ui/components/sidebar";
import { Toaster } from "@repo/ui/components/toaster";

// Every namespace: a client component reaching for one that was not shipped would suspend the
// whole page until it loaded.
const PLATFORM_NAMESPACES: Namespace[] = [...namespaces];

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

const getCallbackUrl = async () => {
  // Get the current path from the 'x-current-path' header.
  // This logic mirrors how `pathname` is fetched later in the provided code.
  // It assumes `x-current-path` provides the necessary path information (path and query string).
  const currentPathAndQuery = (await headers()).get("x-current-path") ?? "/";

  return encodeURIComponent(currentPathAndQuery);
};

export default async function AppLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  const session = await auth();

  if (!session?.user) {
    const callbackUrl = await getCallbackUrl();

    // Redirect to login if no session
    redirect(`/${locale}/login?callbackUrl=${callbackUrl}`);
  }
  if (!session.user.registered) {
    const callbackUrl = await getCallbackUrl();

    // If the user is not registered, redirect them to the registration page.
    redirect(`/${locale}/register?callbackUrl=${callbackUrl}`);
  }

  // The same person and memberships the backend checks, so one PostHog rule decides both sides.
  const [releaseNotes, isCalibrationEnabled, bundles] = await Promise.all([
    fetchWebReleaseNotes(locale),
    isFeatureFlagEnabledForSession(FEATURE_FLAGS.CALIBRATION, session),
    loadNamespaceBundles(locale, PLATFORM_NAMESPACES),
  ]);

  return (
    <TranslationBundles resources={bundles}>
      <PrincipalProvider userId={session.user.id}>
        <SidebarProvider defaultWidth={232}>
          <CalibrationFlagProvider isEnabled={isCalibrationEnabled}>
            <ActivityProvider>
              <NavigationSidebarWrapper
                locale={locale}
                releaseNotes={releaseNotes}
                user={{ id: session.user.id, email: session.user.email }}
                isCalibrationEnabled={isCalibrationEnabled}
              />
              <SidebarEdgePeek />
              <SidebarInset>
                <PlatformHeaderProvider>
                  <SiteHeaderWrapper locale={locale} />
                  <div className="3xl:px-10 4xl:px-14 flex flex-1 flex-col px-4 py-4 md:px-6 md:py-6">
                    <PageContainer width="wide" className="flex flex-1 flex-col gap-4">
                      <Suspense>{children}</Suspense>
                    </PageContainer>
                  </div>
                </PlatformHeaderProvider>
              </SidebarInset>
              <ShortcutsRoot locale={locale} />
              <CommandPalette locale={locale} />
              <Toaster />
              <ShortcutHint />
              <PasskeyCreatePrompt userId={session.user.id} sessionId={session.session.id} />
              <WhatsNewSheet entries={releaseNotes} />
            </ActivityProvider>
          </CalibrationFlagProvider>
        </SidebarProvider>
      </PrincipalProvider>
    </TranslationBundles>
  );
}
