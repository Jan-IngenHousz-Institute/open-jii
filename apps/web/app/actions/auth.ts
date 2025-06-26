"use server";

import { signIn, signOut } from "@/lib/auth";

export async function handleLogin() {
  await signIn();
}

export async function handleLogout({ redirectTo = "/", redirect = true } = {}) {
  await signOut({ redirectTo, redirect });
}
