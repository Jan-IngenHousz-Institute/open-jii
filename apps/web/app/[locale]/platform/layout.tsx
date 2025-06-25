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

export default async function AppLayout({
  children,
  pageTitle,
  params,
}: Readonly<{
  children: React.ReactNode;
  pageTitle?: string;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  const typedLocale = locale as Locale;
  const session = await auth();

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (!session?.user) {
    // Get the current path from the 'x-current-path' header.
    // This logic mirrors how `pathname` is fetched later in the provided code.
    // It assumes `x-current-path` provides the necessary path information (path and query string).
    const currentPathAndQuery = (await headers()).get("x-current-path") ?? "/";

    const callbackUrl = encodeURIComponent(currentPathAndQuery);
    redirect(`/api/auth/signin?callbackUrl=${callbackUrl}`);
    // The redirect() function throws an error to stop rendering and initiate the redirect,
    // so no 'return' statement is needed after it.
  }

  const pathname = (await headers()).get("x-current-path") ?? "/";

  return (
    <SidebarProvider>
      <AppSidebarWrapper locale={typedLocale} user={session.user} />
      <SidebarInset>
        <header className="group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear">
          <div className="flex w-full items-center justify-between gap-2 px-4">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
              <Breadcrumbs pathname={pathname} pageTitle={pageTitle} locale={typedLocale} />
            </div>
            <div className="flex items-center gap-2">
              <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
              <LanguageSwitcher locale={typedLocale} />
            </div>
          </div>
        </header>
        <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col p-4">{children}</main>
        <Toaster />
      </SidebarInset>
    </SidebarProvider>
  );
}
