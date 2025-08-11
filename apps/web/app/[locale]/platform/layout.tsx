import { Breadcrumbs } from "@/components/app-breadcrumbs";
import { AppSidebarWrapper } from "@/components/app-sidebar-wrapper";
import { LanguageSwitcher } from "@/components/language-switcher";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type React from "react";

import type { Locale } from "@repo/i18n";
import {
  Separator,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
  Toaster,
} from "@repo/ui/components";

const getCallbackUrl = async () => {
  // Get the current path from the 'x-current-path' header.
  // This logic mirrors how `pathname` is fetched later in the provided code.
  // It assumes `x-current-path` provides the necessary path information (path and query string).
  const currentPathAndQuery = (await headers()).get("x-current-path") ?? "/";

  return encodeURIComponent(currentPathAndQuery);
};

export default async function AppLayout({
  children,
  pageTitle,
  params,
}: Readonly<{
  children: React.ReactNode;
  pageTitle?: string;
  params: Promise<{ locale: Locale }>;
}>) {
  const { locale } = await params;
  const session = await auth();

  if (!session?.user) {
    const callbackUrl = await getCallbackUrl();

    // The redirect() function throws an error to stop rendering and initiate the redirect,
    // so no 'return' statement is needed after it.
    redirect(`/api/auth/signin?callbackUrl=${callbackUrl}`);
  }
  if (!session.user.registered) {
    const callbackUrl = await getCallbackUrl();

    // If the user is not registered, redirect them to the registration page.
    redirect(`/${locale}/register?callbackUrl=${callbackUrl}`);
  }

  const pathname = (await headers()).get("x-current-path") ?? "/";

  return (
    <SidebarProvider>
      <AppSidebarWrapper locale={locale} user={session.user} />
      <SidebarInset>
        <header className="group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear">
          <div className="flex w-full items-center justify-between gap-2 px-4">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
              <Breadcrumbs pathname={pathname} pageTitle={pageTitle} locale={locale} />
            </div>
            <div className="flex items-center gap-2">
              <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
              <LanguageSwitcher locale={locale} />
            </div>
          </div>
        </header>
        <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col p-4">{children}</main>
        <Toaster />
      </SidebarInset>
    </SidebarProvider>
  );
}
