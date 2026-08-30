import { ActivityProvider } from "@/components/activity/activity-context";
import { PasskeyCreatePrompt } from "@/components/auth/passkey-create-prompt";
import { CommandPalette } from "@/components/command/command-palette";
import { NavigationSidebarWrapper } from "@/components/navigation/navigation-sidebar-wrapper/navigation-sidebar-wrapper";
import { PlatformHeaderProvider } from "@/components/navigation/site-header/platform-header-context";
import { SiteHeader } from "@/components/navigation/site-header/site-header";
import { PageContainer } from "@/components/page-container";
import { ShortcutHint } from "@/components/shortcuts/shortcut-hint";
import { ShortcutsRoot } from "@/components/shortcuts/shortcuts-root";
import { fetchWebReleaseNotes } from "@/components/whats-new/fetch-release-notes";
import { WhatsNewSheet } from "@/components/whats-new/whats-new-sheet";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type React from "react";
import { Suspense } from "react";
import { auth } from "~/app/actions/auth";

import { SidebarEdgePeek, SidebarInset, SidebarProvider } from "@repo/ui/components/sidebar";
import { Toaster } from "@repo/ui/components/toaster";

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

  const releaseNotes = await fetchWebReleaseNotes(locale);

  return (
    <SidebarProvider defaultWidth={232}>
      <ActivityProvider>
        <NavigationSidebarWrapper
          locale={locale}
          distinctId={session.user.email || session.user.id}
          releaseNotes={releaseNotes}
          user={{ id: session.user.id, email: session.user.email }}
        />
        <SidebarEdgePeek />
        <SidebarInset>
          <PlatformHeaderProvider>
            <SiteHeader locale={locale} />
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
    </SidebarProvider>
  );
}
