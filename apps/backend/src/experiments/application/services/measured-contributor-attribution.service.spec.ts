import {
  WellKnownColumnTypes,
  zExperimentDataContributor,
} from "@repo/api/domains/experiment/data/experiment-data.schema";

import type { UserPresencePort } from "../../../users/core/ports/user-presence.port";
import { MeasuredContributorAttributionService } from "./measured-contributor-attribution.service";

describe("measured contributor attribution", () => {
  const guest = "b4eeb9dd-a8a1-4358-a74a-a5ae2d6f921c";
  const former = "c58fe9eb-bf2c-4b75-9b66-445716ec7d47";
  const columns = [
    { name: "contributor", type_text: WellKnownColumnTypes.CONTRIBUTOR },
    { name: "is_guest", type_text: "BOOLEAN" },
  ];
  const cell = (id: string, name: string) => JSON.stringify({ id, name, avatar: "cached-avatar" });
  const parse = (value: string | null) =>
    zExperimentDataContributor.parse(JSON.parse(value ?? "null"));

  it("clears an invalid guest identifier without querying Postgres and leaves malformed cells untouched", async () => {
    const findExistingIds = vi.fn<UserPresencePort["findExistingIds"]>();
    const service = new MeasuredContributorAttributionService({ findExistingIds });
    const rows = await service.enrichRows(
      [
        { is_guest: "true", contributor: cell("invalid", "Cached name") },
        { is_guest: "true", contributor: "invalid json" },
      ],
      columns,
    );
    expect(parse(rows[0].contributor)).toMatchObject({
      name: "",
      avatar: null,
      isFormerGuest: true,
    });
    expect(rows[1].contributor).toBe("invalid json");
    expect(findExistingIds).not.toHaveBeenCalled();
  });

  it("uses trusted guest rows and current account presence without storing labels in names", async () => {
    const findExistingIds = vi.fn<UserPresencePort["findExistingIds"]>().mockResolvedValue([guest]);
    const service = new MeasuredContributorAttributionService({ findExistingIds });
    const rows = await service.enrichRows(
      [
        { is_guest: "true", contributor: cell(guest, "Synthetic") },
        { is_guest: "true", contributor: cell(former, "Old cached name") },
        { is_guest: "false", contributor: cell("researcher", "Researcher") },
      ],
      columns,
    );
    expect(parse(rows[0].contributor)).toEqual({
      id: guest,
      name: "Synthetic",
      avatar: null,
      isGuest: true,
      isFormerGuest: false,
    });
    expect(parse(rows[1].contributor)).toEqual({
      id: former,
      name: "",
      avatar: null,
      isGuest: true,
      isFormerGuest: true,
    });
    expect(parse(rows[2].contributor)).toEqual({
      id: "researcher",
      name: "Researcher",
      avatar: "cached-avatar",
      isGuest: false,
      isFormerGuest: false,
    });
    expect(findExistingIds).toHaveBeenCalledExactlyOnceWith([guest, former]);
  });

  it("rechecks presence after purge instead of retaining cached names", async () => {
    const findExistingIds = vi
      .fn<UserPresencePort["findExistingIds"]>()
      .mockResolvedValueOnce([guest])
      .mockResolvedValueOnce([]);
    const service = new MeasuredContributorAttributionService({ findExistingIds });
    const input = [{ is_guest: "true", contributor: cell(guest, "Synthetic") }];
    expect(parse((await service.enrichRows(input, columns))[0].contributor).isFormerGuest).toBe(
      false,
    );
    expect(parse((await service.enrichRows(input, columns))[0].contributor)).toMatchObject({
      name: "",
      isFormerGuest: true,
    });
    expect(input[0].contributor).toBe(cell(guest, "Synthetic"));
  });

  it("matches UUID account ids regardless of their stored text casing", async () => {
    const findExistingIds = vi.fn<UserPresencePort["findExistingIds"]>().mockResolvedValue([guest]);
    const service = new MeasuredContributorAttributionService({ findExistingIds });
    const [row] = await service.enrichRows(
      [{ is_guest: "true", contributor: cell(guest.toUpperCase(), "Synthetic") }],
      columns,
    );
    expect(parse(row.contributor)).toMatchObject({ name: "Synthetic", isFormerGuest: false });
    expect(findExistingIds).toHaveBeenCalledExactlyOnceWith([guest]);
  });

  it("ignores guest flags inside contributor payloads and does not guess from missing researchers", async () => {
    const findExistingIds = vi.fn<UserPresencePort["findExistingIds"]>();
    const service = new MeasuredContributorAttributionService({ findExistingIds });
    const [row] = await service.enrichRows(
      [
        {
          contributor: JSON.stringify({
            id: former,
            name: "Deleted User",
            avatar: null,
            isGuest: true,
            isFormerGuest: true,
          }),
        },
      ],
      columns.slice(0, 1),
    );
    expect(parse(row.contributor)).toMatchObject({
      name: "Deleted User",
      isGuest: false,
      isFormerGuest: false,
    });
    expect(findExistingIds).not.toHaveBeenCalled();
  });
});
