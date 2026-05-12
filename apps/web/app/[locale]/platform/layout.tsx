import { ActivityProvider } from "@/components/activity/activity-context";
import { CommandPalette } from "@/components/command/command-palette";
import { NavigationSidebarWrapper } from "@/components/navigation/navigation-sidebar-wrapper/navigation-sidebar-wrapper";
import { PageContainer } from "@/components/page-container";
import { ShortcutsRoot } from "@/components/shortcuts/shortcuts-root";
import { WhatsNewProvider } from "@/components/whats-new/whats-new-context";
import { WhatsNewSheet } from "@/components/whats-new/whats-new-sheet";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type React from "react";
import { Suspense } from "react";
import { auth } from "~/app/actions/auth";

import { SidebarFloatingReopen, SidebarInset, SidebarProvider } from "@repo/ui/components/sidebar";
import { Toaster } from "@repo/ui/components/toaster";

import { Breadcrumbs } from "../../../components/navigation/navigation-breadcrumbs/navigation-breadcrumbs";
import { NavigationTopbar } from "../../../components/navigation/navigation-topbar/navigation-topbar";

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

  return (
    <SidebarProvider>
      <ActivityProvider>
       <WhatsNewProvider>
        <NavigationSidebarWrapper locale={locale} />
        <SidebarFloatingReopen />
        <SidebarInset>
          <NavigationTopbar locale={locale} user={session.user} />
            <div className="3xl:px-10 4xl:px-14 flex flex-1 flex-col px-4 pb-6 pt-8 md:px-6">
              <PageContainer width="wide" className="flex flex-1 flex-col gap-4">
                <Breadcrumbs locale={locale} />
                <Suspense>{children}</Suspense>
              </PageContainer>
            </div>
        </SidebarInset>
        <ShortcutsRoot locale={locale} />
        <CommandPalette locale={locale} />
        <WhatsNewSheet />
        <Toaster />
       </WhatsNewProvider>
      </ActivityProvider>
    </SidebarProvider>
  );
}
