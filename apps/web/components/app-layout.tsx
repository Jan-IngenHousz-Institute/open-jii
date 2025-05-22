import { Breadcrumbs } from "@/components/app-breadcrumbs";
import { AppSidebar } from "@/components/app-sidebar";
import type { NavUserType } from "@/components/nav-user";
import { headers } from "next/headers";
import type React from "react";

import { auth } from "@repo/auth/next";
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
  const session = await auth();
  const user: NavUserType = {
    name: session?.user?.name ?? "Jan IngenHousz",
    email: session?.user?.email ?? "jan@openjii.org",
    avatar: "/avatars/shadcn.jpg",
  };

  return (
    <SidebarProvider>
      <AppSidebar user={user} />
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
