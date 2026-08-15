import { HttpService } from "@nestjs/axios";
import { ConfigService } from "@nestjs/config";
import axios from "axios";

import { DeltaConfigService } from "../config/delta-config.service";
import { DeltaSharingService } from "./delta-sharing.service";

const NDJSON = [
  JSON.stringify({ protocol: { minReaderVersion: 1 } }),
  JSON.stringify({
    metaData: {
      id: "m1",
      format: { provider: "parquet" },
      schemaString: "{}",
      partitionColumns: [],
    },
  }),
  JSON.stringify({
    file: {
      url: "https://s3/prefix/file-a.parquet?sig=1",
      id: "a",
      partitionValues: {},
      size: 100,
      stats: JSON.stringify({
        numRecords: 10,
        minValues: { experiment_id: "exp-1" },
        maxValues: { experiment_id: "exp-1" },
      }),
    },
  }),
  JSON.stringify({
    file: {
      url: "https://s3/prefix/file-b.parquet?sig=2",
      id: "b",
      partitionValues: {},
      size: 100,
      stats: JSON.stringify({
        numRecords: 10,
        minValues: { experiment_id: "exp-5" },
        maxValues: { experiment_id: "exp-9" },
      }),
    },
  }),
  JSON.stringify({
    file: {
      url: "https://s3/prefix/file-c.parquet?sig=3",
      id: "c",
      partitionValues: { experiment_id: "exp-2" },
      size: 100,
    },
  }),
].join("\n");

describe("DeltaSharingService", () => {
  let service: DeltaSharingService;
  let httpService: HttpService;

  beforeEach(() => {
    const configService = new ConfigService({
      delta: {
        endpoint: "https://share.example/delta-sharing",
        bearerToken: "token-1",
        shareName: "open-jii",
        schemaName: "centrum",
      },
    });
    httpService = new HttpService(axios.create());
    service = new DeltaSharingService(httpService, new DeltaConfigService(configService));
  });

  it("queries the share endpoint with escaped predicate hints and parses NDJSON", async () => {
    const post = vi
      .spyOn(httpService.axiosRef, "post")
      .mockResolvedValue({ data: NDJSON, headers: { "delta-table-version": "7" } });

    const result = await service.getDataFileUrls("enriched_experiment_macro_data", [
      ["experiment_id", "exp-1"],
    ]);

    expect(result.isSuccess()).toBe(true);
    expect(post).toHaveBeenCalledWith(
      "https://share.example/delta-sharing/shares/open-jii/schemas/centrum/tables/enriched_experiment_macro_data/query",
      { predicateHints: ["`experiment_id` = 'exp-1'"] },
      {
        headers: {
          Authorization: "Bearer token-1",
          "Content-Type": "application/json",
          Accept: "application/x-ndjson; charset=utf-8",
        },
        timeout: 30000,
        responseType: "text",
      },
    );
  });

  it("prunes files whose stats or partition values exclude the scope", async () => {
    vi.spyOn(httpService.axiosRef, "post").mockResolvedValue({ data: NDJSON, headers: {} });

    const result = await service.getDataFileUrls("t", [["experiment_id", "exp-1"]]);

    expect(result.isSuccess()).toBe(true);
    if (result.isFailure()) throw result.error;
    // file-a matches by stats; file-b excluded by min/max; file-c excluded by
    // partition value.
    expect(result.value).toEqual(["https://s3/prefix/file-a.parquet?sig=1"]);
  });

  it("keeps files without stats (conservative pruning)", async () => {
    const noStats = [
      JSON.stringify({ protocol: { minReaderVersion: 1 } }),
      JSON.stringify({
        metaData: {
          id: "m1",
          format: { provider: "parquet" },
          schemaString: "{}",
          partitionColumns: [],
        },
      }),
      JSON.stringify({
        file: { url: "https://s3/unknown.parquet", id: "u", partitionValues: {}, size: 1 },
      }),
    ].join("\n");
    vi.spyOn(httpService.axiosRef, "post").mockResolvedValue({ data: noStats, headers: {} });

    const result = await service.getDataFileUrls("t", [["experiment_id", "exp-1"]]);

    expect(result.isSuccess()).toBe(true);
    if (result.isFailure()) throw result.error;
    expect(result.value).toEqual(["https://s3/unknown.parquet"]);
  });

  it("fails on responses missing protocol or metadata", async () => {
    vi.spyOn(httpService.axiosRef, "post").mockResolvedValue({ data: "{}", headers: {} });

    const result = await service.getDataFileUrls("t", []);

    expect(result.isFailure()).toBe(true);
  });

  it("never sends limitHint: the server may drop files the SQL still paginates", async () => {
    const post = vi
      .spyOn(httpService.axiosRef, "post")
      .mockResolvedValue({ data: NDJSON, headers: {} });

    await service.getDataFileUrls("t", [["experiment_id", "exp-1"]]);

    expect(post.mock.calls[0][1]).toEqual({ predicateHints: ["`experiment_id` = 'exp-1'"] });
  });

  it("follows nextPageToken until the listing is exhausted", async () => {
    const page1 = [
      JSON.stringify({ protocol: { minReaderVersion: 1 } }),
      JSON.stringify({
        metaData: {
          id: "m1",
          format: { provider: "parquet" },
          schemaString: "{}",
          partitionColumns: [],
        },
      }),
      JSON.stringify({
        file: { url: "https://s3/p1.parquet", id: "1", partitionValues: {}, size: 1 },
      }),
      JSON.stringify({ endStreamAction: { nextPageToken: "tok-2" } }),
    ].join("\n");
    const page2 = [
      JSON.stringify({ protocol: { minReaderVersion: 1 } }),
      JSON.stringify({
        metaData: {
          id: "m1",
          format: { provider: "parquet" },
          schemaString: "{}",
          partitionColumns: [],
        },
      }),
      JSON.stringify({
        file: { url: "https://s3/p2.parquet", id: "2", partitionValues: {}, size: 1 },
      }),
      JSON.stringify({ endStreamAction: {} }),
    ].join("\n");

    const post = vi
      .spyOn(httpService.axiosRef, "post")
      .mockResolvedValueOnce({ data: page1, headers: {} })
      .mockResolvedValueOnce({ data: page2, headers: {} });

    const result = await service.getDataFileUrls("t", []);

    expect(result.isSuccess()).toBe(true);
    if (result.isFailure()) throw result.error;
    expect(result.value).toEqual(["https://s3/p1.parquet", "https://s3/p2.parquet"]);
    expect(post).toHaveBeenCalledTimes(2);
    expect(post.mock.calls[1][1]).toEqual({ predicateHints: [], pageToken: "tok-2" });
  });

  it("keeps files whose stats look truncated rather than dropping real rows", async () => {
    // A 32-char min/max that prefixes the 36-char UUID scope is Delta's
    // truncated-stat shape; comparing against it would exclude a match.
    const uuid = "0123456789abcdef0123456789abcdef-aaa";
    const truncated = [
      JSON.stringify({ protocol: { minReaderVersion: 1 } }),
      JSON.stringify({
        metaData: {
          id: "m1",
          format: { provider: "parquet" },
          schemaString: "{}",
          partitionColumns: [],
        },
      }),
      JSON.stringify({
        file: {
          url: "https://s3/truncated.parquet",
          id: "t",
          partitionValues: {},
          size: 1,
          stats: JSON.stringify({
            minValues: { experiment_id: uuid.slice(0, 32) },
            maxValues: { experiment_id: uuid.slice(0, 32) },
          }),
        },
      }),
    ].join("\n");
    vi.spyOn(httpService.axiosRef, "post").mockResolvedValue({ data: truncated, headers: {} });

    const result = await service.getDataFileUrls("t", [["experiment_id", uuid]]);

    expect(result.isSuccess()).toBe(true);
    if (result.isFailure()) throw result.error;
    expect(result.value).toEqual(["https://s3/truncated.parquet"]);
  });

  it("falls back to the served files when pruning would eliminate every one", async () => {
    // Both files carry stats that exclude the scope. Trusting that would drop
    // real rows, so the whole served list is scanned and SQL filters it.
    vi.spyOn(httpService.axiosRef, "post").mockResolvedValue({ data: NDJSON, headers: {} });

    const result = await service.getDataFileUrls("t", [["experiment_id", "exp-nonexistent"]]);

    expect(result.isSuccess()).toBe(true);
    if (result.isFailure()) throw result.error;
    expect(result.value).toHaveLength(3);
  });
});
