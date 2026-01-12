"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { env } from "~/env";

const BACKEND_URL = env.NEXT_PUBLIC_API_URL;

export async function handleLogout({ redirectTo = "/" } = {}) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("better-auth.session-token")?.value;

    if (sessionToken) {
      // Call backend to invalidate session
      await fetch(`${BACKEND_URL}/auth/signout`, {
        method: "POST",
        headers: {
          Cookie: `better-auth.session-token=${sessionToken}`,
        },
      });

      // Clear the session cookie
      cookieStore.delete("better-auth.session-token");
    }
  } catch (error) {
    console.error("Logout error:", error);
  }

  redirect(redirectTo);
}

export async function handleRegister() {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("better-auth.session-token")?.value;

    if (sessionToken) {
      // Update user as registered
      await fetch(`${BACKEND_URL}/auth/user`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Cookie: `better-auth.session-token=${sessionToken}`,
        },
        body: JSON.stringify({ registered: true }),
      });
    }
  } catch (error) {
    console.error("Register error:", error);
    throw error;
  }
}

export async function signInWithEmail(email: string) {
  try {
    const response = await fetch(`${BACKEND_URL}/auth/signin/email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      const error = (await response.json()) as { message?: string };
      throw new Error(error.message ?? "Failed to send email");
    }

    return (await response.json()) as { success: boolean; message: string };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Failed to sign in";
    console.error("Sign in error:", errorMessage);
    throw new Error(errorMessage);
  }
}

export async function verifyEmailCode(email: string, code: string) {
  try {
    const response = await fetch(`${BACKEND_URL}/auth/verify/email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, code }),
    });

    if (!response.ok) {
      const error = (await response.json()) as { message?: string };
      throw new Error(error.message ?? "Invalid code");
    }

    const data = (await response.json()) as {
      user: { id: string; email: string; name: string; registered: boolean };
      session: { token: string; expiresAt: string };
    };

    // Set the session cookie
    const cookieStore = await cookies();
    const secure = env.NODE_ENV === "production";
    cookieStore.set("better-auth.session-token", data.session.token, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      maxAge: new Date(data.session.expiresAt).getTime() - Date.now(),
    });

    return data;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Failed to verify code";
    console.error("Verify error:", errorMessage);
    throw new Error(errorMessage);
  }
}
