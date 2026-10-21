export * from "drizzle-orm";
// `alias` lives in the pg-core entrypoint (not the drizzle-orm root) — re-export it so consumers
// can build table aliases without importing drizzle-orm directly.
export { alias } from "drizzle-orm/pg-core";
export * from "./database";
export * from "./schema";
export * from "./organizations";
export * from "./resource-grants";
