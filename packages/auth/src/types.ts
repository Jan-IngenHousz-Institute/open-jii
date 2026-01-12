import type { authClient } from "./client";

export type Session = typeof authClient.$Infer.Session;
export type User = NonNullable<Session>["user"];

/**
 * Type guard to check if the session exists and has a user
 *
 * @param session - The session object to check
 * @returns true if the session exists and has a user, false otherwise
 */
export const isSession = (session: Session): session is NonNullable<Session> => {
  return !!session.user;
};
