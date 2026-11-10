import { resolve } from "node:path";

import { assertSuccess } from "../../../../../utils/fp-utils";
import { SqlQueryBuilder } from "../query-builder.base";
import { QueryBuilderService } from "../query-builder.service";
import type { QueryParams } from "../query-builder.types";
import { deviceDisplaySource } from "./device-label";

// Spark executes this fixture, so its regressions exercise the backend's exact SQL.
it("keeps the Spark device-display fixture in sync with generated queries", async () => {
  const service = new QueryBuilderService();
  const table = deviceDisplaySource("display_measurements", service.query(), [
    "id",
    "experiment_id",
    "client_id",
    "device_id",
    "device_name",
    "device",
    "signal",
    "payload",
  ]);
  const query = (options: Omit<QueryParams, "table">) => {
    const result = service.buildQuery({
      table,
      whereConditions: [["experiment_id", "e1"]],
      ...options,
    });
    assertSuccess(result);
    return result.value;
  };
  const projected = query({ columns: ["id", "device"], ordering: { column: "id" } });
  const serials = query({ columns: ["device.serial_number"] });
  const queries = {
    projected,
    legacyView: (() => {
      const result = service.buildQuery({
        table: deviceDisplaySource("legacy_measurements", service.query()),
        columns: ["id", "device"],
        ordering: { column: "id" },
      });
      assertSuccess(result);
      return result.value;
    })(),
    staleColumns: (() => {
      const result = service.buildQuery({
        table: deviceDisplaySource("display_measurements", service.query(), [
          "id",
          "experiment_id",
          "device_id",
          "device_name",
          "device",
          "signal",
          "payload",
        ]),
      });
      assertSuccess(result);
      return result.value;
    })(),
    all: query({}),
    filtered: query({
      columns: ["id", "device"],
      filters: [{ column: "device.serial_number", operator: "equals", value: "Ambit (d2)" }],
    }),
    sorted: query({ columns: ["id", "device"], ordering: { column: "device.serial_number" } }),
    grouped: query({
      aggregation: {
        groupBy: [{ column: "device" }],
        functions: [{ column: "id", function: "count", alias: "rows" }],
      },
    }),
    distinct: new SqlQueryBuilder()
      .select(["serial_number"])
      .distinct()
      .from(`(${serials}) AS device_names`)
      .where("`serial_number` IS NOT NULL AND trim(`serial_number`) <> ''")
      .orderByRaw("lower(`serial_number`) ASC, `serial_number` ASC")
      .limit(1001)
      .offset(0)
      .build(),
    hiddenClient: query({
      exceptColumns: ["client_id"],
      variants: [{ columnName: "payload", schema: "OBJECT<client_id: STRING>", suffix: "output" }],
      reservedColumns: ["id", "experiment_id", "device_id", "device_name", "device", "signal"],
    }),
    variant: query({
      columns: ["device", "device_output"],
      variants: [{ columnName: "payload", schema: "OBJECT<device: STRING>", suffix: "output" }],
      reservedColumns: [
        "id",
        "experiment_id",
        "client_id",
        "device_id",
        "device_name",
        "device",
        "signal",
      ],
    }),
  };
  await expect(JSON.stringify(queries, null, 2) + "\n").toMatchFileSnapshot(
    resolve(__dirname, "../../../../../../../../data/tests/fixtures/device-display-queries.json"),
  );
});
