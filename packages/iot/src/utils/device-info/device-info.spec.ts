import { describe, expect, it } from "vitest";

import { INFO_COMMAND, parseInfoData, parseInfoReply, reportedMac } from "./device-info";

describe("INFO contract", () => {
  it("is the JSON INFO command", () => {
    expect(JSON.parse(INFO_COMMAND)).toEqual({ command: "INFO" });
  });

  it("finds the status line among other output", () => {
    const reply =
      'boot noise\n{"status":"success","data":{"device_type":"minipar","device_id":"AA:BB:CC:DD:EE:01"}}\n';
    expect(parseInfoReply(reply)).toEqual({
      status: "success",
      data: { device_type: "minipar", device_id: "AA:BB:CC:DD:EE:01" },
    });
    expect(parseInfoData(reply)).toEqual({
      device_type: "minipar",
      device_id: "AA:BB:CC:DD:EE:01",
    });
  });

  it("gives no data for an error or a non-JSON reply", () => {
    expect(parseInfoData('{"status":"error","error":"unknown command"}')).toBeNull();
    expect(parseInfoData("BAD COMMAND")).toBeNull();
    expect(parseInfoData("")).toBeNull();
  });
});

describe("reportedMac", () => {
  it("accepts the firmware's six-byte colon form and uppercases it", () => {
    expect(reportedMac("aa:bb:cc:dd:ee:ff")).toBe("AA:BB:CC:DD:EE:FF");
    expect(reportedMac(" 24:6F:28:01:02:03 ")).toBe("24:6F:28:01:02:03");
  });

  it("rejects anything that is not a six-byte colon MAC", () => {
    for (const value of [
      undefined,
      null,
      42,
      "",
      "a1:b2:c3:d4",
      "AABBCCDDEEFF",
      "AA-BB-CC-DD-EE-FF",
    ]) {
      expect(reportedMac(value)).toBeUndefined();
    }
  });
});
