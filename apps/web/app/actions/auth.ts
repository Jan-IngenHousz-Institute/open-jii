"use server";

import { signIn, signOut, auth, unstableUpdate } from "@/lib/auth";

export async function handleLogin() {
  await signIn();
}

export async function handleLogout({ redirectTo = "/", redirect = true } = {}) {
  await signOut({ redirectTo, redirect });
}

export async function handleRegister() {
  const session = await auth();

  if (session?.user) {
    await unstableUpdate({ ...session, user: { ...session.user, registered: true } });
  }
}
