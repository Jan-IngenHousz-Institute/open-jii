import type React from "react";
import { headers } from "next/headers";
import { Separator, SidebarInset, SidebarProvider, SidebarTrigger } from "@repo/ui/components";
import { AppSidebar } from "@/components/app-sidebar";
import { Breadcrumbs } from "@/components/app-breadcrumbs";

export async function AppLayout({ children, pageTitle }: Readonly<{
  children: React.ReactNode;
  pageTitle?: string;
}>) {
  const pathname = (await headers()).get("x-current-path") ?? "/";

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
            <Breadcrumbs pathname={pathname} pageTitle={pageTitle} />
          </div>
        </header>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
