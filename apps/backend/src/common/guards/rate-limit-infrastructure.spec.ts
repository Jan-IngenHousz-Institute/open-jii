import type { AnyContractProcedure } from "@orpc/contract";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";

const root = resolve(__dirname, "../../../../..");
const read = (path: string) => readFileSync(join(root, path), "utf8");
const waf = read("infrastructure/modules/waf/main.tf");

function blocks(source: string, declaration: RegExp): string[] {
  const found: string[] = [];
  for (const match of source.matchAll(declaration)) {
    const start = match.index;
    let cursor = start + match[0].length;
    let depth = 1;
    while (depth > 0 && cursor < source.length) {
      if (source[cursor] === "{") depth++;
      if (source[cursor] === "}") depth--;
      cursor++;
    }
    expect(depth).toBe(0);
    found.push(source.slice(start, cursor));
  }
  return found;
}
function rule(name: string) {
  const found = blocks(waf, /(?:dynamic "rule"|\brule)\s*\{/g).filter((block) =>
    block.includes(`"${name}"`),
  );
  expect(found).toHaveLength(1);
  return found[0];
}
const machinePaths = [
  ...(/machine_post_paths\s*=\s*\[([^\]]+)\]/.exec(waf)?.[1] ?? "").matchAll(/"([^"\n]+)"/g),
].map((match) => match[1]);

describe("CloudFront rate-limit configuration", () => {
  it("keeps the exact machine path list aligned with every HmacGuard controller", async () => {
    const controllers = readdirSync(join(root, "apps/backend/src"), {
      recursive: true,
      encoding: "utf8",
    }).filter((file) => file.endsWith(".controller.ts"));
    const paths: string[] = [];
    for (const file of controllers) {
      const source = read(`apps/backend/src/${file}`);
      if (!source.includes("HmacGuard")) continue;
      expect(source).toMatch(/@UseGuards\(HmacGuard\)/);
      const endpoints = [...source.matchAll(/@Implement\((\w+)\.(\w+)\)/g)];
      expect(endpoints.length, file).toBeGreaterThan(0);
      for (const [, symbol, member] of endpoints) {
        const modulePath = [
          ...source.matchAll(/import \{ (\w+) \} from "(@repo\/api\/[^"\n]+)"/g),
        ].find((match) => match[1] === symbol)?.[2];
        expect(modulePath, file).toBeDefined();
        if (!modulePath) throw new Error(`Contract import missing in ${file}`);
        const imported = (await import(/* @vite-ignore */ modulePath)) as Record<
          string,
          Record<string, AnyContractProcedure>
        >;
        const endpoint = imported[symbol][member]["~orpc"].route;
        expect(endpoint.method, file).toBe("POST");
        expect(endpoint.path, file).toBeDefined();
        if (!endpoint.path) throw new Error(`Contract path missing in ${file}`);
        paths.push(endpoint.path);
      }
    }
    expect(paths.sort()).toEqual([...machinePaths].sort());
    expect(paths).toHaveLength(5);
  });

  it("uses source IP with complementary exact POST scopes and explicit priorities", () => {
    expect(waf).toMatch(/scope\s*=\s*"CLOUDFRONT"/);
    const general = rule("RateLimitRule");
    const machine = rule("MachineRateLimitRule");
    for (const block of [general, machine]) {
      expect(block).toMatch(/aggregate_key_type\s*=\s*"IP"/);
      expect(block).not.toContain("forwarded_ip_config");
      expect(block).toMatch(/for_each\s*=\s*local.machine_post_paths/);
      expect(block).toMatch(/search_string\s*=\s*"POST"/);
      expect(block).toMatch(/search_string\s*=\s*statement.value/);
      expect(
        [...block.matchAll(/positional_constraint\s*=\s*"([^"\n]+)"/g)].map((match) => match[1]),
      ).toEqual(["EXACTLY", "EXACTLY"]);
      expect([...block.matchAll(/type\s*=\s*"([^"\n]+)"/g)].map((match) => match[1])).toEqual([
        "IP",
        "NONE",
        "NONE",
      ]);
      expect(block).toMatch(/method\s*\{/);
      expect(block).toMatch(/uri_path\s*\{/);
    }
    expect(general).toMatch(/not_statement\s*\{/);
    expect(machine).not.toContain("not_statement");
    expect(general).toMatch(/priority\s*=\s*4/);
    expect(machine).toMatch(/priority\s*=\s*5/);
    expect(machine).toMatch(/limit\s*=\s*10000/);
    expect(rule("GeoBlockRule")).toMatch(/priority\s*=\s*var.enable_machine_rate_limit \? 6 : 5/);
    expect(rule("AllowLargeBodyRule")).toMatch(
      /priority\s*=\s*var.enable_machine_rate_limit \? 7 : 6/,
    );
  });

  it.each(["dev", "prod", "dr"])("configures protected ingress and backend rules in %s", (env) => {
    const source = read(`infrastructure/env/${env}/main.tf`);
    const backend = blocks(source, /module "backend_waf"\s*\{/g)[0];
    expect(backend).toMatch(/rate_limit\s*=\s*2500/);
    expect(backend).toMatch(/enable_machine_rate_limit\s*=\s*true/);
    expect(source).toMatch(
      /name\s*=\s*"AUTH_CLIENT_ADDRESS_MODE",?\s*value\s*=\s*"cloudfront-alb"/,
    );
    const alb = read("infrastructure/modules/alb/main.tf");
    expect(alb).toMatch(/xff_header_processing_mode\s*=\s*"append"/);
    expect(alb).toMatch(/enable_xff_client_port\s*=\s*false/);
  });
});
