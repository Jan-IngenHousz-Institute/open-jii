import { auth } from "./better-auth";

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.User;
