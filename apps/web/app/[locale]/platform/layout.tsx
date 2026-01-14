import { NavigationSidebarWrapper } from "@/components/navigation/navigation-sidebar-wrapper/navigation-sidebar-wrapper";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type React from "react";
import { auth } from "~/app/actions/auth";

import { SidebarInset, SidebarProvider, Toaster } from "@repo/ui/components";

import { BreadcrumbProvider } from "../../../components/navigation/breadcrumb-context";
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
      <BreadcrumbProvider>
        <NavigationSidebarWrapper locale={locale} />
        <SidebarInset>
          <NavigationTopbar locale={locale} user={session.user} />
          <div className="flex flex-1 flex-col gap-4 p-6 pt-8">
            <div className="mx-auto w-full max-w-7xl">
              <Breadcrumbs locale={locale} />
              {children}
            </div>
          </div>
        </SidebarInset>
        <Toaster />
      </BreadcrumbProvider>
    </SidebarProvider>
  );
}
