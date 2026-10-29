import { GuestDemoAdapter } from "./guest-demo.adapter";

describe("Demo mode adapter", () => {
  it("defaults to disabled when the test environment has no analytics client", async () => {
    expect(await new GuestDemoAdapter().isEnabled()).toBe(false);
  });
});
