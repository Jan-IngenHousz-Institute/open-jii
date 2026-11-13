import {
  DEVICE_LOCATION_ID_MAX_LENGTH,
  fromDeviceLocationId,
  toDeviceLocationId,
} from "./device-location-id";

// Shared with the Ambyte firmware: both sides must produce these ids byte for byte.
const VECTORS: [string, string | null][] = [
  ["ambyte_28:37:2F:FF:E7:04", "ambyte-5F28-3A37-3A2F-3AFF-3AE7-3A04"],
  ["AMBYTE_E8:F6:0A:B1:1D:D4", "AMBYTE-5FE8-3AF6-3A0A-3AB1-3A1D-3AD4"],
  ["AMBYTE28:37:2F:FF:FC:24", "AMBYTE28-3A37-3A2F-3AFF-3AFC-3A24"],
  ["mobile_614277f4-9fc5", "mobile-5F614277f4-2D9fc5"],
  ["a-b", "a-2Db"],
  ["a_b", "a-5Fb"],
  ["a:b", "a-3Ab"],
  ["-", "-2D"],
  ["café", "caf-C3-A9"],
  ["", null],
  ["a".repeat(128), "a".repeat(128)],
  ["a".repeat(129), null],
  ["a".repeat(125) + "_", "a".repeat(125) + "-5F"],
  ["a".repeat(126) + "_", null],
];

const ALPHABET = ["a", "Z", "0", "9", "-", "_", ":", ".", "é"];

function randomThingName(random: () => number): string {
  const length = 1 + Math.floor(random() * 12);
  return Array.from({ length }, () => ALPHABET[Math.floor(random() * ALPHABET.length)]).join("");
}

// Deterministic, so a failure reproduces.
function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2 ** 31;
    return state / 2 ** 31;
  };
}

describe("toDeviceLocationId", () => {
  it.each(VECTORS)("maps %j to %j", (thingName, expected) => {
    expect(toDeviceLocationId(thingName)).toBe(expected);
  });

  it("gives the serials edge_box, edge-box and edge:box three different ids", () => {
    const ids = ["generic_edge_box", "generic_edge-box", "generic_edge:box"].map(
      toDeviceLocationId,
    );
    expect(new Set(ids).size).toBe(3);
  });

  it("never lets a dashed serial take over a colon-separated MAC's id", () => {
    expect(toDeviceLocationId("ambyte_28-37-2F-FF-E7-04")).not.toBe(
      toDeviceLocationId("ambyte_28:37:2F:FF:E7:04"),
    );
  });

  it("only produces ids AWS accepts, within the cap", () => {
    const random = seeded(7);
    for (let run = 0; run < 2000; run++) {
      const id = toDeviceLocationId(randomThingName(random));
      if (id === null) continue;
      expect(id).toMatch(/^[A-Za-z0-9-]+$/);
      expect(id.length).toBeLessThanOrEqual(DEVICE_LOCATION_ID_MAX_LENGTH);
    }
  });

  it("is injective: distinct thing names never share an id", () => {
    const random = seeded(42);
    const owners = new Map<string, string>();
    for (let run = 0; run < 5000; run++) {
      const thingName = randomThingName(random);
      const id = toDeviceLocationId(thingName);
      if (id === null) continue;
      const owner = owners.get(id);
      if (owner !== undefined) expect(owner).toBe(thingName);
      owners.set(id, thingName);
    }
  });
});

describe("fromDeviceLocationId", () => {
  it("round-trips every encodable thing name", () => {
    const random = seeded(99);
    for (let run = 0; run < 2000; run++) {
      const thingName = randomThingName(random);
      const id = toDeviceLocationId(thingName);
      if (id !== null) expect(fromDeviceLocationId(id)).toBe(thingName);
    }
  });

  it.each(["a-2", "a-zz", "a-41", "a_b", "-FF", ""])(
    "rejects %j, which no thing name encodes to",
    (id) => {
      expect(fromDeviceLocationId(id)).toBeNull();
    },
  );
});
