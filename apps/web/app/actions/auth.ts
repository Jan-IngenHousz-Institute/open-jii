"use server";

import { signOut } from "@repo/auth/next";

export async function handleLogout() {
  await signOut({ redirectTo: "/", redirect: true });
}
