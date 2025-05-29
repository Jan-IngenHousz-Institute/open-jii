import * as React from "react";

import { auth } from "@repo/auth/next";

import { AppSidebar } from "./app-sidebar";

export async function AppSidebarWrapper(
  props: Omit<React.ComponentProps<typeof AppSidebar>, "user">,
) {
  const session = await auth();

  return <AppSidebar user={session?.user} {...props} />;
}
