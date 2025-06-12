import { Breadcrumbs } from "@/components/app-breadcrumbs";
import { AppSidebar } from "@/components/app-sidebar";
import { headers } from "next/headers";
import type React from "react";

import {
  Separator,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
  Toaster,
} from "@repo/ui/components";

export async function AppLayout({
  children,
  pageTitle,
}: Readonly<{
  children: React.ReactNode;
  pageTitle?: string;
}>) {
  const pathname = (await headers()).get("x-current-path") ?? "/";
  const locale = pathname.split("/")[1] || "en-US"; // Default to 'en-US' if no locale is found

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-2 data-[orientation=vertical]:h-4"
            />
            <Breadcrumbs
              pathname={pathname}
              pageTitle={pageTitle}
              //@ts-expect-error string is not an accepted type for locale
              locale={locale}
            />
          </div>
        </header>
        <main className="flex flex-1 flex-col p-4">{children}</main>
        <Toaster />
      </SidebarInset>
    </SidebarProvider>
  );
}
