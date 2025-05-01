"use server";

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import "server-only";

// if (!process.env.SESSION_SECRET) {
//   throw new Error("SESSION_SECRET environment variable is not set.");
// }
const secretKey = process.env.SESSION_SECRET! || "todo_set_secret_key";
const encodedKey = new TextEncoder().encode(secretKey);

type SessionPayload = {
  userId: string;
  expiresAt: string; // Use ISO string for better serialization
};

// Helper function to validate the payload
function isPayloadValid(payload: any): payload is SessionPayload {
  return (
    typeof payload === "object" &&
    typeof payload.userId === "string" &&
    typeof payload.expiresAt === "string"
  );
}

// Encrypt the session payload into a JWT
export async function encrypt(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(encodedKey);
}

// Decrypt and verify the session token
export async function decrypt(
  session: string | undefined,
): Promise<SessionPayload | null> {
  if (!session) return null;
  try {
    const { payload } = await jwtVerify(session, encodedKey, {
      algorithms: ["HS256"],
    });
    if (!isPayloadValid(payload)) {
      console.error("Invalid session payload:", payload);
      return null;
    }
    return payload as SessionPayload;
  } catch (error) {
    console.error("Failed to verify session:", error);
    return null;
  }
}

// Create and store a new session token in a secure cookie
export async function createSession(userId: string): Promise<void> {
  const expiresAt = new Date(
    Date.now() + 7 * 24 * 60 * 60 * 1000,
  ).toISOString(); // 7 days
  const session = await encrypt({ userId, expiresAt });

  const cookieStore = cookies();
  (await cookieStore).set("session", session, {
    httpOnly: true,
    secure: true, // Use true in production (HTTPS only)
    expires: new Date(expiresAt),
    sameSite: "lax",
    path: "/",
  });
}

// Retrieve and validate the session
export async function getSession(): Promise<SessionPayload | null> {
  const cookie = (await cookies()).get("session")?.value;
  if (!cookie) {
    console.warn("No session cookie found");
    return null;
  }

  return decrypt(cookie);
}

// Update an existing session by extending its expiration
export async function updateSession(): Promise<void> {
  const session = (await cookies()).get("session")?.value;
  const payload = await decrypt(session);

  if (!session || !payload) {
    console.warn("No valid session found for update");
    return;
  }

  const expiresAt = new Date(
    Date.now() + 7 * 24 * 60 * 60 * 1000,
  ).toISOString(); // Extend session
  const updatedSession = await encrypt({ ...payload, expiresAt });

  const cookieStore = cookies();
  (await cookieStore).set("session", updatedSession, {
    httpOnly: true,
    secure: true,
    expires: new Date(expiresAt),
    sameSite: "lax",
    path: "/",
  });
}

// Delete the session cookie
export async function deleteSession(): Promise<void> {
  const cookieStore = cookies();
  (await cookieStore).delete("session");
}
