import { describe, it, expect } from "vitest";

import { contract, iotContract } from "./index";

describe("API Package Exports", () => {
    it("should export main contract", () => {
        expect(contract).toBeDefined();
    });

    it("should export iotContract", () => {
        expect(iotContract).toBeDefined();
        expect(iotContract.getCredentials).toBeDefined();
    });
});
