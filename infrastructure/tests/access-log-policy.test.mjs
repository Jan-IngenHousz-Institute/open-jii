import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const infrastructure = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function terraformFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name.startsWith(".")) return [];
    const path = join(directory, entry.name);
    return entry.isDirectory()
      ? terraformFiles(path)
      : /\.tf(?:\.json)?$/.test(entry.name)
        ? [path]
        : [];
  });
}

function withoutComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*(?:#|\/\/).*$/gm, "");
}

function readTerraform(path) {
  return withoutComments(readFileSync(path, "utf8"));
}

function cookieLoggingViolations(source) {
  return [...withoutComments(source).matchAll(/\binclude_cookies\s*=\s*([^\r\n]*)/g)]
    .map((match) => match[1].trim())
    .filter((value) => !/^false\s*(?:(?:#|\/\/).*)?$/.test(value));
}

function unreviewedLoggingTypes(source) {
  return [
    ...withoutComments(source).matchAll(
      /resource\s+"(aws_cloudfront_realtime_log_config|aws_cloudwatch_log_delivery_source|aws_cloudwatch_log_delivery)"/g,
    ),
  ].map((match) => match[1]);
}

test("every distribution keeps cookie values out of access logs", () => {
  for (const path of terraformFiles(infrastructure)) {
    assert.ok(
      !path.endsWith(".tf.json"),
      `${path}: extend the access-log policy before adding Terraform JSON`,
    );
    assert.deepEqual(
      unreviewedLoggingTypes(readTerraform(path)),
      [],
      `${relative(infrastructure, path)}: extend the cookie-field policy before adding standard v2 or real-time logging`,
    );
    assert.deepEqual(
      cookieLoggingViolations(readTerraform(path)),
      [],
      `${relative(infrastructure, path)}: include_cookies must be the literal false`,
    );
  }
});

test("the guard rejects enabled and computed cookie logging", () => {
  assert.deepEqual(cookieLoggingViolations("include_cookies = true"), ["true"]);
  assert.deepEqual(cookieLoggingViolations("include_cookies = var.cookies"), ["var.cookies"]);
  assert.deepEqual(cookieLoggingViolations("include_cookies = false # request metadata only"), []);
  assert.deepEqual(
    cookieLoggingViolations("# include_cookies = true\n/* include_cookies = true */"),
    [],
  );
});

test("new logging delivery types require reviewed cookie-field support", () => {
  for (const type of [
    "aws_cloudfront_realtime_log_config",
    "aws_cloudwatch_log_delivery_source",
    "aws_cloudwatch_log_delivery",
  ]) {
    assert.deepEqual(unreviewedLoggingTypes(`resource "${type}" "new" {}`), [type]);
  }
});

test("the API and web distributions explicitly disable cookie logging", () => {
  for (const module of ["backend-cloudfront", "opennext/opennext-cloudfront"]) {
    const source = readTerraform(join(infrastructure, "modules", module, "main.tf"));
    assert.match(
      source,
      /\binclude_cookies\s*=\s*false\b/,
      `${module}: set include_cookies = false`,
    );
  }
});

test("all environments expire CloudFront access logs and old versions after 30 days", () => {
  for (const environment of ["dev", "prod", "dr"]) {
    const source = readTerraform(join(infrastructure, "env", environment, "main.tf"));
    const logsBucket = source.match(/module "logs_bucket"\s*\{([\s\S]*?)^\}/m)?.[1];
    assert.ok(logsBucket, `${environment}: access-log bucket must exist`);
    assert.match(
      logsBucket,
      /\blifecycle_rules\s*=/,
      `${environment}: access logs need a lifecycle rule`,
    );
    const rule = logsBucket.match(/\{\s*id\s*=\s*"expire-cloudfront-access-logs"([\s\S]*?)\}/)?.[1];
    assert.ok(rule, `${environment}: the CloudFront retention rule must exist`);
    assert.match(
      rule,
      /\bprefix\s*=\s*"cloudfront-logs\/"/,
      `${environment}: scope retention to CloudFront`,
    );
    assert.match(rule, /\bstatus\s*=\s*"Enabled"/, `${environment}: enable retention`);
    assert.match(rule, /\bexpiration_days\s*=\s*30\b/, `${environment}: expire current logs`);
    assert.match(
      rule,
      /\bnoncurrent_version_expiration_days\s*=\s*30\b/,
      `${environment}: expire previous log versions`,
    );
  }
});

test("firewall logs still redact cookie and authorization headers", () => {
  const source = readTerraform(join(infrastructure, "modules/waf/main.tf"));
  const logging = source.match(
    /resource "aws_wafv2_web_acl_logging_configuration" "main"\s*\{([\s\S]*?)^\}/m,
  )?.[1];
  assert.ok(logging, "firewall logging configuration must exist");
  for (const header of ["cookie", "authorization"]) {
    assert.match(
      logging,
      new RegExp(`redacted_fields\\s*\\{\\s*single_header\\s*\\{\\s*name\\s*=\\s*"${header}"`),
      `firewall logs must redact ${header}`,
    );
  }
});
