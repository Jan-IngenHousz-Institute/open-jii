import { testStoreAdmin } from "./store-admin";

describe("testStoreAdmin", () => {
  beforeEach(() => {
    vi.stubEnv("CLICKHOUSE_TEST_PORT", "8124");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("refuses a store on another machine", () => {
    vi.stubEnv("SERVING_STORE_URL", "https://store.example.com:8124");

    expect(() => testStoreAdmin()).toThrow("not https://store.example.com:8124");
  });

  it("refuses a store on this machine but another port than the test store's", () => {
    vi.stubEnv("SERVING_STORE_URL", "http://127.0.0.1:8123");

    expect(() => testStoreAdmin()).toThrow("not http://127.0.0.1:8123");
  });
});
