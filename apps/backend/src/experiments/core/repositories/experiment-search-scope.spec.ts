import { fromPartial } from "@total-typescript/shoehorn";

import type { DatabaseInstance } from "@repo/database";

import * as accessScope from "../../../common/utils/resource-access-scope";
import { searchableExperimentCondition } from "./experiment-search-scope";

describe("searchableExperimentCondition", () => {
  it("throws when the access predicate is missing instead of dropping it", () => {
    vi.spyOn(accessScope, "readingResourceCondition").mockReturnValue(undefined);
    expect(() =>
      searchableExperimentCondition(fromPartial<DatabaseInstance>({}), crypto.randomUUID()),
    ).toThrow("Experiment search requires an access scope");
  });
});
