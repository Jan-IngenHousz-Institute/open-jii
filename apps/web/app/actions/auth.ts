"use server";

import { signIn, signOut } from "@repo/auth/next";

export async function handleLogin() {
  await signIn();
}

export async function handleLogout() {
  await signOut({ redirectTo: "/", redirect: false });
}
