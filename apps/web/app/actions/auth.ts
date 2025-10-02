"use server";

import { signIn, signOut, auth, unstableUpdate } from "@/lib/auth";
import { redirect } from "next/navigation";

import { AuthError } from "@repo/auth/next";

const SIGNIN_ERROR_URL = "/error";

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

export async function signInAction(
  providerId: string,
  callbackUrl: string | undefined,
  email?: string,
) {
  try {
    if (providerId === "nodemailer" && !email) {
      throw new Error("Email is required");
    }
    await signIn(providerId, {
      redirectTo: callbackUrl,
      ...(providerId === "nodemailer" && email ? { email } : {}),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return redirect(`${SIGNIN_ERROR_URL}?error=${error.type}`);
    }
    throw error;
  }
}
