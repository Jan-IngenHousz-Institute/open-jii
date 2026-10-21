import { readFileSync } from "node:fs";

const waf = readFileSync(
  new URL("../../../../infrastructure/modules/waf/main.tf", import.meta.url),
  "utf8",
);

describe("guest entry edge limit", () => {
  it("scopes its 300-per-five-minute source-IP limit to the anonymous POST endpoint", () => {
    const start = waf.indexOf('name     = "GuestSessionRateLimit"');
    const end = waf.indexOf('name     = "RateLimitRule"', start);
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    const rule = waf.slice(start, end);
    expect(rule).toMatch(/limit\s*=\s*300\b/);
    expect(rule).toMatch(/evaluation_window_sec\s*=\s*300\b/);
    expect(rule).toMatch(/aggregate_key_type\s*=\s*"IP"/);
    expect(rule).toContain('search_string         = "/api/v1/auth/sign-in/anonymous"');
    expect(rule).toContain('search_string         = "POST"');
    expect(rule.match(/positional_constraint\s*=\s*"EXACTLY"/g)).toHaveLength(2);
    expect(rule).toContain("uri_path {}");
    expect(rule).toContain("method {}");
    expect(rule).toContain("and_statement");
    expect(rule).toMatch(/sampled_requests_enabled\s*=\s*false/);
  });

  it("keeps rule priorities distinct from nested text transformation priorities", () => {
    const priorities = [...waf.matchAll(/name\s*=\s*"[^"]+"\s+priority\s*=\s*(\d+)/g)].map(
      (match) => match[1],
    );
    expect(priorities).toContain("4");
    expect(new Set(priorities).size).toBe(priorities.length);
  });
});
