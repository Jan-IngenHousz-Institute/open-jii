import { getAuth } from "./better-auth";

type AuthInstance = Awaited<ReturnType<typeof getAuth>>;

export type AuthResponse = AuthInstance["$Infer"]["Session"];
export type User = AuthResponse["user"];
export type Session = AuthResponse["session"];
