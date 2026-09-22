import type { experiments, iotDevices, macros, protocols, users } from "../../src/schema";

export type SeedUser = typeof users.$inferSelect;
export type SeedProtocol = typeof protocols.$inferSelect;
export type SeedMacro = typeof macros.$inferSelect;
export type SeedExperiment = typeof experiments.$inferSelect;
export type SeedDevice = typeof iotDevices.$inferSelect;
