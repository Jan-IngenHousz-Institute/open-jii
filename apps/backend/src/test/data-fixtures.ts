import { resolve } from "node:path";

/** Path to a fixture in `apps/data/tests/fixtures`, which the backend and data tests share. */
export function dataFixture(name: string): string {
  return resolve(__dirname, "../../../data/tests/fixtures", name);
}
