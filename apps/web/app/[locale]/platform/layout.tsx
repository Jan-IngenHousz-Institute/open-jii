import { NavigationSidebarWrapper } from "@/components/navigation/navigation-sidebar-wrapper/navigation-sidebar-wrapper";
import { ProfileActivator } from "@/components/profile-activator";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type React from "react";

import { SidebarInset, SidebarProvider, Toaster } from "@repo/ui/components";

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
  pageTitle,
  params,
}: Readonly<{
  children: React.ReactNode;
  pageTitle?: string;
  params: Promise<{ locale: string }>;
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

  return (
    <SidebarProvider>
      <ProfileActivator />
      <NavigationSidebarWrapper locale={locale} />
      <NavigationTopbar locale={locale} user={session.user} />
      <SidebarInset>
        <div className="flex flex-1 flex-col gap-4 p-6 pt-20">
          <div className="mx-auto w-full max-w-7xl">
            <Breadcrumbs pageTitle={pageTitle} locale={locale} />
            {children}
          </div>
        </div>
      </SidebarInset>
      <Toaster />
    </SidebarProvider>
  );
}
