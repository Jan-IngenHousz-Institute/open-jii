import type {
  experiments,
  iotDevices,
  macros,
  protocols,
  users,
  workbooks,
} from "../../src/postgres/schema";

export type SeedUser = typeof users.$inferSelect;
export type SeedProtocol = typeof protocols.$inferSelect;
export type SeedMacro = typeof macros.$inferSelect;
export type SeedExperiment = typeof experiments.$inferSelect;
export type SeedDevice = typeof iotDevices.$inferSelect;
export type SeedWorkbook = typeof workbooks.$inferSelect;
