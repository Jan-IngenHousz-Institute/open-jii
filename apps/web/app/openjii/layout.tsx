import { Breadcrumbs } from "@/components/app-breadcrumbs";
import { AppSidebarWrapper } from "@/components/app-sidebar-wrapper";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type React from "react";

import { auth } from "@repo/auth/next";
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
}: Readonly<{
  children: React.ReactNode;
  pageTitle?: string;
}>) {
  const session = await auth();

  if (!session) {
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
      <AppSidebarWrapper />
      <SidebarInset>
        <header className="group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-2 data-[orientation=vertical]:h-4"
            />
            <Breadcrumbs pathname={pathname} pageTitle={pageTitle} />
          </div>
        </header>
        <main className="flex flex-1 flex-col p-4">{children}</main>
        <Toaster />
      </SidebarInset>
    </SidebarProvider>
  );
}
