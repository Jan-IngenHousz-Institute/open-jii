import { AsyncLocalStorage } from "node:async_hooks";

// Client provisioning is restricted to the operator CLI, never an HTTP session.
export const oauthClientManagement = new AsyncLocalStorage<boolean>();
