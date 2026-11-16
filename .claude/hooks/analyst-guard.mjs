// Keeps an agent session from changing cloud state, and from reading production until the developer
// opens a window in their own terminal. It applies to every session and every role, in Claude Code
// and in Codex, because the danger is not role-specific.
//
// This is a guardrail, not the boundary. The boundary is the analyst permission set in AWS, described
// in infrastructure/policies/README.md. The guard refuses a mistaken command with a reason before it
// reaches AWS, Databricks or OpenTofu at all.
//
// It reads the command the way a shell would: quotes, escapes, line continuations, substitutions,
// heredocs and nested shells. Quoted text and heredoc bodies are data, so a commit message that
// mentions a cloud command is not one, while a command inside a substitution still runs and is
// checked.
import { execFileSync } from "node:child_process";
import { appendFileSync, statSync } from "node:fs";
import { join } from "node:path";

export const PROD_WINDOW_SECONDS = 7200;

const GUARDED = new Set(["aws", "databricks", "tofu", "terraform", "kubectl"]);
const TRIGGER =
  /aws|databricks|tofu|terraform|kubectl|analyst|tf|AWS_|DATABRICKS_|\.env|tfvars|tfstate|credentials|databrickscfg/i;

// Files that hold secrets. The examples and test defaults that the repository tracks stay readable.
const SECRET_FILE =
  /(^|\/)(\.env|\.env\.local|\.env\.[\w-]+\.local|\.env\.production|[\w.-]+\.tfvars(\.json)?|[\w.-]*\.tfstate(\.backup)?|\.databrickscfg)$|(^|\/)\.aws\/(credentials|sso\/cache\/)/;
const SHELLS = new Set(["bash", "sh", "zsh", "dash", "ksh"]);
const KEYWORDS = new Set(["!", "if", "then", "elif", "else", "while", "until", "do", "time", "{"]);
const NOT_COMMANDS = new Set(["for", "case", "select", "fi", "done", "esac", "}", "in"]);
const CREDENTIAL_ASSIGNMENT =
  /^(AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY|AWS_SESSION_TOKEN|DATABRICKS_TOKEN|DATABRICKS_CLIENT_SECRET)=/;
const PROD_NAME = /(^|[\s=/_.:-])(prod|production|dr)($|[\s/_.:-])/i;
const PROD_PROFILE = /(^|[-_])(prod|production|dr)$/i;
// The window command and its marker file, glob spellings included, but not a profile that merely
// ends in analyst-prod.
const PROD_WINDOW = /analyst[-:_]prod(?=[-._:*?[]|w|o)/i;
const UNKNOWN = "\u0000";

/** Buckets whose objects are operational state rather than research data. */
const READABLE_BUCKET = /^open-jii-(heartbeat|status-state)-[a-z0-9-]+$/;

class Refusal extends Error {}

function refuse(reason) {
  throw new Refusal(reason);
}

/** Returns the index just past the heredoc bodies that start after position `from`. */
function skipHeredocBody(source, from, delimiter, strip) {
  let i = source.indexOf("\n", from);
  if (i < 0) return source.length;
  i++;
  while (i < source.length) {
    let end = source.indexOf("\n", i);
    if (end < 0) end = source.length;
    const line = source.slice(i, end);
    i = end + 1;
    if ((strip ? line.replace(/^\t+/, "") : line) === delimiter) return i;
  }
  return source.length;
}

const HEREDOC_START = /^<<(-?)[ \t]*(['"]?)([^\s'";&|<>()]+)\2/;

/**
 * Finds the end of a `$(...)`, honouring quotes and heredocs inside it, since a commit message
 * written as `"$(cat <<'EOF' ... EOF)"` is the commonest substitution an agent writes.
 */
function closingParen(source, from) {
  let depth = 1;
  let i = from;
  const pending = [];
  while (i < source.length) {
    const c = source[i];
    if (c === "\\") {
      i += 2;
      continue;
    }
    if (c === "\n" && pending.length > 0) {
      for (const doc of pending.splice(0))
        i = skipHeredocBody(source, i - 1, doc.delimiter, doc.strip);
      continue;
    }
    if (c === "'") {
      const end = source.indexOf("'", i + 1);
      if (end < 0) refuse("the command has an unclosed quote.");
      i = end + 1;
      continue;
    }
    if (c === '"') {
      i++;
      while (i < source.length && source[i] !== '"') {
        if (source[i] === "\\") i++;
        else if (source.startsWith("$(", i)) i = closingParen(source, i + 2);
        i++;
      }
      i++;
      continue;
    }
    if (c === "<" && source[i + 1] === "<" && source[i + 2] !== "<") {
      const match = HEREDOC_START.exec(source.slice(i));
      if (match) {
        pending.push({ delimiter: match[3], strip: match[1] === "-" });
        i += match[0].length;
        continue;
      }
    }
    if (c === "(") depth++;
    if (c === ")" && --depth === 0) return i;
    i++;
  }
  refuse("the command has an unclosed bracket.");
}

/** The commands an unquoted heredoc body runs: its `$(...)` and backtick substitutions. */
function substitutionsIn(text) {
  const found = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "\\") {
      i++;
    } else if (text.startsWith("$(", i)) {
      const end = closingParen(text, i + 2);
      found.push(text.slice(i + 2, end));
      i = end;
    } else if (text[i] === "`") {
      const end = text.indexOf("`", i + 1);
      if (end < 0) refuse("the command has an unclosed backtick.");
      found.push(text.slice(i + 1, end));
      i = end;
    }
  }
  return found;
}

/**
 * Splits a command string into simple commands. Each command is a list of words and a list of
 * redirection targets. A word carries its unquoted text, whether any of it was quoted, and whether
 * it holds an expansion whose value the guard cannot know. Commands inside substitutions come back
 * as commands of their own, because the shell runs them.
 */
export function parse(source) {
  const commands = [];
  let words = [];
  let redirects = [];
  let word = null;
  let redirectNext = false;
  const heredocs = [];
  let i = 0;

  const start = () => {
    word ??= { text: "", quoted: false, dynamic: false };
  };
  const endWord = () => {
    if (!word) return;
    (redirectNext ? redirects : words).push(word);
    redirectNext = false;
    word = null;
  };
  const endCommand = () => {
    endWord();
    if (words.length > 0 && NOT_COMMANDS.has(words[0].text) && !words[0].quoted) words.shift();
    if (words.length > 0 || redirects.length > 0) commands.push({ words, redirects });
    words = [];
    redirects = [];
  };
  const unknown = () => {
    start();
    word.text += UNKNOWN;
    word.dynamic = true;
  };
  const substitution = () => {
    const arithmetic = source.startsWith("$((", i);
    const end = closingParen(source, i + 2);
    const inner = source.slice(i + 2, end);
    // Arithmetic runs nothing but the substitutions inside it.
    if (arithmetic) for (const nested of substitutionsIn(inner)) commands.push(...parse(nested));
    else commands.push(...parse(inner));
    i = end + 1;
    if (arithmetic && source[i] === ")") i++;
    unknown();
  };
  const backtick = () => {
    const end = source.indexOf("`", i + 1);
    if (end < 0) refuse("the command has an unclosed backtick.");
    commands.push(...parse(source.slice(i + 1, end)));
    i = end + 1;
    unknown();
  };
  const variable = () => {
    if (source[i + 1] === "{") {
      const end = source.indexOf("}", i + 2);
      if (end < 0) refuse("the command has an unclosed variable.");
      i = end + 1;
    } else if (/[A-Za-z_]/.test(source[i + 1])) {
      i++;
      while (/\w/.test(source[i] ?? "")) i++;
    } else {
      i += 2;
    }
    unknown();
  };
  const isVariableStart = () => source[i] === "$" && /[\w{@*#?$!-]/.test(source[i + 1] ?? "");
  const readHeredocBodies = () => {
    for (const doc of heredocs.splice(0)) {
      const end = skipHeredocBody(source, i - 1, doc.delimiter, doc.strip);
      const body = source.slice(i, end);
      i = end;
      if (!doc.quoted) for (const inner of substitutionsIn(body)) commands.push(...parse(inner));
    }
  };

  while (i < source.length) {
    const c = source[i];

    if (c === "\\") {
      if (source[i + 1] === "\n") {
        i += 2;
        continue;
      }
      start();
      word.text += source[i + 1] ?? "";
      i += 2;
    } else if (c === "$" && source[i + 1] === "'") {
      // ANSI-C quoting, where escapes such as \x61 spell out characters.
      start();
      word.quoted = true;
      i += 2;
      while (i < source.length && source[i] !== "'") {
        if (source[i] !== "\\") {
          word.text += source[i];
          i++;
          continue;
        }
        const escape =
          /^\\(x[0-9a-fA-F]{1,2}|u[0-9a-fA-F]{1,4}|U[0-9a-fA-F]{1,8}|[0-7]{1,3}|.)/s.exec(
            source.slice(i),
          );
        const code = escape?.[1] ?? "";
        if (/^[xuU]/.test(code)) word.text += String.fromCodePoint(parseInt(code.slice(1), 16));
        else if (/^[0-7]/.test(code)) word.text += String.fromCodePoint(parseInt(code, 8));
        else word.text += { n: "\n", t: "\t", r: "\r", a: "\u0007", e: "\u001b" }[code] ?? code;
        i += 1 + code.length;
      }
      if (i >= source.length) refuse("the command has an unclosed quote.");
      i++;
    } else if (c === "$" && source[i + 1] === '"') {
      // Locale quoting behaves like double quotes.
      i++;
    } else if (c === "'") {
      const end = source.indexOf("'", i + 1);
      if (end < 0) refuse("the command has an unclosed quote.");
      start();
      word.text += source.slice(i + 1, end);
      word.quoted = true;
      i = end + 1;
    } else if (c === '"') {
      start();
      word.quoted = true;
      i++;
      while (i < source.length && source[i] !== '"') {
        if (source[i] === "\\" && '$`"\\\n'.includes(source[i + 1])) {
          if (source[i + 1] !== "\n") word.text += source[i + 1];
          i += 2;
        } else if (source.startsWith("$(", i)) {
          substitution();
        } else if (source[i] === "`") {
          backtick();
        } else if (isVariableStart()) {
          variable();
        } else {
          word.text += source[i];
          i++;
        }
      }
      if (i >= source.length) refuse("the command has an unclosed quote.");
      i++;
    } else if (c === "$" && source[i + 1] === "(") {
      substitution();
    } else if (c === "`") {
      backtick();
    } else if (isVariableStart()) {
      variable();
    } else if (c === "#" && !word) {
      const end = source.indexOf("\n", i);
      i = end < 0 ? source.length : end;
    } else if (c === " " || c === "\t") {
      endWord();
      i++;
    } else if (c === "\n") {
      endCommand();
      i++;
      readHeredocBodies();
    } else if (";&|()".includes(c)) {
      endCommand();
      i++;
    } else if (c === "<" || c === ">") {
      if (word && /^\d+$/.test(word.text) && !word.quoted) word = null;
      else endWord();
      const heredoc = c === "<" ? HEREDOC_START.exec(source.slice(i)) : null;
      if (heredoc && !source.startsWith("<<<", i)) {
        heredocs.push({
          delimiter: heredoc[3],
          quoted: heredoc[2] !== "",
          strip: heredoc[1] === "-",
        });
        i += heredoc[0].length;
        continue;
      }
      i++;
      while (">&<|".includes(source[i] ?? "x")) i++;
      if (source[i - 1] === "&" && /[\d-]/.test(source[i] ?? "")) {
        while (/[\d-]/.test(source[i] ?? "")) i++;
        continue;
      }
      redirectNext = true;
    } else {
      start();
      word.text += c;
      // An unquoted glob or brace means the shell, not this text, decides what the word becomes.
      if ("*?[{".includes(c)) word.expands = true;
      i++;
    }
  }

  endCommand();
  return commands;
}

const isAssignment = (w) => !w.quoted && /^[A-Za-z_][A-Za-z0-9_]*=/.test(w.text);
const baseName = (text) => text.replace(/^\\/, "").split("/").pop();

/** Skips a wrapper's options, consuming a value for each option listed as taking one. */
function skipOptions(words, k, withValue = []) {
  while (k < words.length && words[k].text.startsWith("-") && words[k].text !== "-") {
    const option = words[k].text;
    k += withValue.includes(option) ? 2 : 1;
    if (option === "--") break;
  }
  return k;
}

const WRAPPERS = {
  command: ["-a"],
  builtin: [],
  exec: ["-a"],
  nohup: [],
  noglob: [],
  nocorrect: [],
  time: [],
  nice: ["-n"],
  stdbuf: ["-i", "-o", "-e"],
  ionice: ["-c", "-n", "-p"],
  setsid: [],
  chrt: ["-p"],
  sudo: ["-u", "-g", "-h", "-p", "-C", "-D", "-R", "-T", "-U"],
  doas: ["-u", "-C"],
  watch: ["-n", "-d", "--interval"],
};

/**
 * Finds the program a simple command runs, looking past assignments, keywords and the wrappers that
 * run their arguments as a command. Nested shells, eval and find -exec come back as further commands.
 */
function resolve(command) {
  const { words } = command;
  const assignments = [];
  const extra = [];
  let viaXargs = false;
  let k = 0;

  while (k < words.length) {
    const w = words[k];
    const base = baseName(w.text);
    if (isAssignment(w)) {
      assignments.push(w.text);
      k++;
    } else if (!w.quoted && KEYWORDS.has(w.text)) {
      k++;
    } else if (base === "env") {
      k++;
      while (k < words.length && (words[k].text.startsWith("-") || isAssignment(words[k]))) {
        if (isAssignment(words[k])) assignments.push(words[k].text);
        k += ["-u", "-C", "-S", "--unset", "--chdir"].includes(words[k].text) ? 2 : 1;
      }
    } else if (
      (base === "command" || base === "builtin") &&
      /^-[vV]$/.test(words[k + 1]?.text ?? "")
    ) {
      break;
    } else if (base in WRAPPERS) {
      k = skipOptions(words, k + 1, WRAPPERS[base]);
    } else if (base === "timeout") {
      k = skipOptions(words, k + 1, ["-s", "-k", "--signal", "--kill-after"]) + 1;
    } else if (base === "xargs") {
      viaXargs = true;
      k = skipOptions(words, k + 1, [
        "-n",
        "-I",
        "-L",
        "-P",
        "-d",
        "-E",
        "-s",
        "-a",
        "-J",
        "-R",
        "-S",
      ]);
    } else {
      break;
    }
  }

  if (k >= words.length) return null;
  const word = words[k];
  const args = words.slice(k + 1);
  const name = baseName(word.text);

  if (SHELLS.has(name)) {
    const flag = args.findIndex((a) => /^-[a-zA-Z]*c[a-zA-Z]*$/.test(a.text));
    if (flag >= 0 && args[flag + 1]) extra.push(...parse(args[flag + 1].text));
  }
  if (name === "eval" && args.length > 0) extra.push(...parse(args.map((a) => a.text).join(" ")));
  if (name === "find") {
    args.forEach((a, j) => {
      if (!["-exec", "-execdir", "-ok", "-okdir"].includes(a.text)) return;
      const end = args.findIndex((b, n) => n > j && (b.text === ";" || b.text === "+"));
      const inner = args.slice(j + 1, end < 0 ? undefined : end);
      if (inner.length > 0) extra.push({ words: inner, redirects: [] });
    });
  }

  return { name, word, args, assignments, extra, viaXargs, redirects: command.redirects };
}

function optionValue(args, ...names) {
  for (let j = 0; j < args.length; j++) {
    for (const name of names) {
      if (args[j].text === name) return args[j + 1]?.text ?? "";
      if (args[j].text.startsWith(`${name}=`)) return args[j].text.slice(name.length + 1);
    }
  }
  return null;
}

const hasOption = (args, name) =>
  args.some((a) => a.text === name || a.text.startsWith(`${name}=`));

/**
 * The positional words of a command, skipping options. An option the guard does not know, seen
 * before the first two positionals, is reported, because it may take a value that would otherwise
 * be read as the service or the verb.
 */
function positionals(args, valueOptions, flagOptions = new Set()) {
  const found = [];
  for (let j = 0; j < args.length; j++) {
    const text = args[j].text;
    if (text.startsWith("-") && text !== "-") {
      if (text.includes("=")) continue;
      if (valueOptions.has(text)) j++;
      else if (!flagOptions.has(text) && found.length < 2) return { found, unknown: text };
      continue;
    }
    found.push(text);
  }
  return { found, unknown: null };
}

const AWS_VALUE_OPTIONS = new Set([
  "--profile",
  "--region",
  "--output",
  "--query",
  "--color",
  "--cli-read-timeout",
  "--cli-connect-timeout",
  "--ca-bundle",
  "--cli-binary-format",
]);
const AWS_FLAG_OPTIONS = new Set([
  "--no-cli-pager",
  "--no-paginate",
  "--no-verify-ssl",
  "--no-sign-request",
  "--no-cli-auto-prompt",
]);
const S3API_OPTIONS = new Set([
  ...AWS_VALUE_OPTIONS,
  "--bucket",
  "--key",
  "--version-id",
  "--range",
]);

const AWS_DATA_VERBS = new Set([
  "get-object",
  "get-secret-value",
  "get-item",
  "batch-get-item",
  "get-records",
  "get-shard-iterator",
  "get-login-password",
  "get-authorization-token",
  "get-thing-shadow",
  "get-credentials-for-identity",
  "get-id",
  "get-session-token",
  "get-federation-token",
  "get-role-credentials",
  "execute-command",
  "invoke",
  "invoke-async",
  "invoke-with-response-stream",
  "start-session",
  "send-command",
  "assume-role",
  "assume-role-with-web-identity",
  "assume-role-with-saml",
  "start-live-tail",
  "create-export-task",
  "download-db-log-file-portion",
]);
const AWS_READ_VERB =
  /^(describe-|list-|get-|lookup-|filter-|search-|simulate-|head-|(batch-get-traces|validate-policy|help|wait|start-query|stop-query|tail)$)/;
const SSM_READS = new Set([
  "describe-parameters",
  "get-parameter",
  "get-parameters",
  "get-parameters-by-path",
  "get-parameter-history",
]);

function checkAws(args) {
  for (const flag of ["--debug", "--endpoint-url", "--cli-input-json", "--cli-input-yaml"]) {
    if (hasOption(args, flag)) {
      refuse(
        `aws ${flag} is not allowed: it prints signing material, redirects the call, or carries a payload the guard cannot read.`,
      );
    }
  }
  if (hasOption(args, "--with-decryption")) refuse("--with-decryption returns a secret value.");

  const { found, unknown } = positionals(args, AWS_VALUE_OPTIONS, AWS_FLAG_OPTIONS);
  if (unknown) {
    refuse(
      `aws ${unknown} before the service cannot be checked. Put options after the service and the verb.`,
    );
  }
  const [service, verb = ""] = found;
  if (!service || service === "help") return;
  const call = `aws ${service} ${verb}`.trim();

  if (["configure", "sso", "sso-oidc", "iot-data", "rds-data"].includes(service)) {
    refuse(`${call} is not something a session runs. Ask the developer.`);
  }

  if (service === "s3") {
    if (verb === "ls" || verb === "") return;
    if (verb === "cp" && !hasOption(args, "--recursive")) {
      const bucket = /^s3:\/\/([^/]+)\//.exec(found[2] ?? "")?.[1] ?? "";
      if (found.length === 4 && found[3] === "-" && READABLE_BUCKET.test(bucket)) return;
    }
    refuse(
      `${call} copies or changes objects. Only a heartbeat or status-state object read to stdout, as in aws s3 cp s3://open-jii-heartbeat-dev/... -, is allowed.`,
    );
  }

  if (service === "s3api" && verb === "get-object") {
    const bucket = optionValue(args, "--bucket") ?? "";
    const { found: paths } = positionals(args, S3API_OPTIONS, AWS_FLAG_OPTIONS);
    if (READABLE_BUCKET.test(bucket) && paths.length === 3 && paths[2] === "/dev/stdout") return;
    refuse(
      `${call} reads object data. Only heartbeat and status-state objects, written to /dev/stdout, are allowed.`,
    );
  }

  if (service === "ssm") {
    if (SSM_READS.has(verb)) return;
    refuse(`${call} is not a parameter read.`);
  }

  if (AWS_DATA_VERBS.has(verb)) {
    refuse(
      `${call} reads data, runs code or mints credentials rather than describing state. That step is the developer's to run.`,
    );
  }
  if (!AWS_READ_VERB.test(verb)) {
    refuse(
      `${call} is not a describe, list or get. A session may read cloud state but never change it.`,
    );
  }

  if (service === "logs") {
    if (/^(filter-log-events|get-log-events|start-query|tail)$/.test(verb)) {
      if (!hasOption(args, "--start-time") && !hasOption(args, "--since")) {
        refuse("a log read needs --start-time or --since.");
      }
    }
    if (verb === "tail" && hasOption(args, "--follow"))
      refuse("aws logs tail --follow never ends.");
    if (hasOption(args, "--unmask"))
      refuse("--unmask shows the log fields a data protection policy masks.");
    // filter-log-events pages on its own, so only --max-items caps the total; get-log-events makes
    // one call, capped by --limit.
    const cap = { "filter-log-events": "--max-items", "get-log-events": "--limit" }[verb];
    if (cap) {
      const value = optionValue(args, cap);
      if (!value || !/^\d+$/.test(value)) refuse(`aws logs ${verb} needs ${cap}.`);
      if (Number(value) > 1000) refuse(`${cap} ${value} is too large; 1000 is the ceiling.`);
    }
  }
}

const DATABRICKS_OPTIONS = new Set([
  "-p",
  "--profile",
  "-o",
  "--output",
  "-t",
  "--target",
  "--log-level",
  "--log-file",
  "--log-format",
]);
const DATABRICKS_READS = new Set([
  "current-user me",
  "auth describe",
  "auth profiles",
  "jobs list",
  "jobs get",
  "jobs list-runs",
  "jobs get-run",
  "jobs get-run-output",
  "pipelines list-pipelines",
  "pipelines get",
  "pipelines list-updates",
  "pipelines get-update",
  "pipelines list-pipeline-events",
  "clusters list",
  "clusters get",
  "clusters events",
  "clusters spark-versions",
  "clusters list-node-types",
  "warehouses list",
  "warehouses get",
  "catalogs list",
  "catalogs get",
  "schemas list",
  "schemas get",
  "tables list",
  "tables get",
  "tables exists",
  "volumes list",
  "volumes get",
  "grants get",
  "grants get-effective",
  "permissions get",
  "permissions get-permission-levels",
  "workspace list",
  "workspace get-status",
  "service-principals list",
  "groups list",
  "secrets list-scopes",
  "secrets list-secrets",
  "secrets list-acls",
  "query-history list",
  "queries list",
  "queries get",
  "system-schemas list",
  "fs ls",
  "bundle validate",
  "bundle summary",
  "statement-execution get-statement",
  "statement-execution get-statement-result-chunk-n",
]);
const SQL_READ_START = /^\s*\(*\s*(select|show|describe|desc|explain|with|values)\b/i;
const SQL_WRITE_WORD =
  /\b(insert|update|delete|merge|create|drop|alter|truncate|grant|revoke|copy|optimize|vacuum|refresh|replace|restore|call|set|use|cache|uncache|msck|analyze|deny|comment)\b/i;

function checkDatabricks(args) {
  if (hasOption(args, "--debug"))
    refuse("databricks --debug prints request details, tokens included.");
  const { found, unknown } = positionals(args, DATABRICKS_OPTIONS);
  if (unknown)
    refuse(`databricks ${unknown} before the command cannot be checked. Put options after it.`);
  const [group, action = ""] = found;
  if (!group || group === "help" || group === "version") return;
  const call = `${group} ${action}`.trim();

  if (call === "statement-execution execute-statement") {
    const statement = optionValue(args, "--statement");
    if (statement === null) refuse("pass the SQL with --statement, so the guard can read it.");
    const bare = statement.replace(/'(?:[^']|'')*'/g, "''").replace(/`[^`]*`/g, "``");
    if (!SQL_READ_START.test(bare))
      refuse("a statement must be a SELECT, SHOW, DESCRIBE, EXPLAIN or WITH query.");
    if (bare.replace(/;\s*$/, "").includes(";"))
      refuse("a statement may not carry a second statement.");
    if (SQL_WRITE_WORD.test(bare)) refuse("a statement may only read, and this one names a write.");
    return;
  }

  if (call === "api get") {
    const path = found[2] ?? "";
    if (/secret|token|credential|password/i.test(path))
      refuse(`databricks api get ${path} returns credentials.`);
    return;
  }

  if (!DATABRICKS_READS.has(call)) refuse(`databricks ${call} is not a read this guard allows.`);
}

function checkTofu(name, args) {
  const sub = args.find((a) => !a.text.startsWith("-"))?.text ?? "";
  if (!["fmt", "validate", "providers", "graph", "version", "help", ""].includes(sub)) {
    refuse(
      `${name} ${sub} is not allowed from a session, plan and init included. Plans and applies run in CI or in your own terminal.`,
    );
  }
}

const KUBECTL_OPTIONS = new Set([
  "-n",
  "--namespace",
  "--context",
  "--kubeconfig",
  "--cluster",
  "--user",
  "-l",
  "--selector",
  "-o",
  "--output",
]);

function checkKubectl(args) {
  const { found } = positionals(
    args,
    KUBECTL_OPTIONS,
    new Set(["-A", "--all-namespaces", "-w", "--watch"]),
  );
  const [sub = "", second = ""] = found;
  const words = args.map((a) => a.text);
  if (sub === "get" && found.some((w) => /^secrets?($|\/)/.test(w)))
    refuse("kubectl get secret returns secret values.");
  if (sub === "config") {
    if (!/^(get-|current-context$|view$)/.test(second)) refuse("kubectl config may only be read.");
    if (words.includes("--raw")) refuse("kubectl config view --raw prints credentials.");
    return;
  }
  if (sub === "cluster-info" && second === "dump")
    refuse("kubectl cluster-info dump copies the whole cluster state.");
  if (
    ![
      "get",
      "describe",
      "logs",
      "top",
      "explain",
      "api-resources",
      "api-versions",
      "version",
      "cluster-info",
      "auth",
      "",
    ].includes(sub)
  ) {
    refuse(`kubectl ${sub} is not a read.`);
  }
}

function profileOf(resolved, context) {
  const { name, args, assignments } = resolved;
  const assigned = (key) => assignments.find((a) => a.startsWith(`${key}=`))?.slice(key.length + 1);
  const explicit =
    name === "aws"
      ? (optionValue(args, "--profile") ?? assigned("AWS_PROFILE"))
      : (optionValue(args, "-p", "--profile") ?? assigned("DATABRICKS_CONFIG_PROFILE"));
  return explicit ?? context.exportedProfile[name] ?? context.environmentProfile[name];
}

function readsProduction(resolved, context) {
  const profile = profileOf(resolved, context);
  if (profile && PROD_PROFILE.test(profile)) return true;
  if (resolved.args.some((a) => PROD_NAME.test(a.text.replace(/^--[a-z-]+=/, "")))) return true;
  return context.inProductionRoot;
}

function collect(source) {
  const all = [];
  const queue = parse(source);
  while (queue.length > 0) {
    const resolved = resolve(queue.shift());
    if (!resolved) continue;
    queue.push(...resolved.extra);
    all.push(resolved);
  }
  return all;
}

/**
 * Decides one command line. Returns whether it touches a guarded tool, so the caller can log it,
 * and throws a Refusal with the reason when it may not run.
 */
export function judge(source, context) {
  // Quotes and escapes come out first, so `a''ws` and `\aws` are seen for what they run.
  const plain = source.replace(/['"\\]/g, "");
  // ANSI-C quoting can spell a name with escapes, so its presence alone sends a command on.
  if (!TRIGGER.test(plain) && !source.includes("$'")) return false;

  let commands;
  try {
    commands = collect(source);
  } catch (error) {
    if (error instanceof Refusal && /\b(aws|databricks|tofu|terraform|kubectl)\b/.test(plain))
      throw error;
    if (error instanceof Refusal) return false;
    throw error;
  }

  for (const r of commands) {
    const exported = r.name === "export" ? r.args.map((a) => a.text) : [];
    for (const assignment of [...r.assignments, ...exported]) {
      if (CREDENTIAL_ASSIGNMENT.test(assignment))
        refuse("credentials do not belong on a command line.");
      const match = /^(AWS_PROFILE|DATABRICKS_CONFIG_PROFILE)=(.*)$/.exec(assignment);
      if (match && exported.includes(assignment)) {
        context.exportedProfile[match[1] === "AWS_PROFILE" ? "aws" : "databricks"] = match[2];
      }
    }
    if (
      r.name === "cd" &&
      r.args.some((a) => /(^|\/)infrastructure\/env\/(prod|dr)(\/|$)/.test(a.text))
    ) {
      context.inProductionRoot = true;
    }
  }

  const namesGuarded = /\b(aws|databricks|tofu|terraform|kubectl)\b/.test(plain);
  let touched = false;

  for (const r of commands) {
    if ((r.word.dynamic || r.word.expands) && namesGuarded) {
      refuse(
        "a command whose name comes from a variable or a substitution cannot be checked. Write the command out.",
      );
    }
    const messageTool = r.name === "git" || r.name === "gh";
    for (const w of [...(messageTool ? [] : [r.word, ...r.args]), ...r.redirects]) {
      if (PROD_WINDOW.test(w.text))
        refuse("only the developer opens the production window, in their own terminal.");
    }
    for (const w of [...(messageTool ? [] : r.args), ...r.redirects]) {
      if (SECRET_FILE.test(w.text.replace(/^~/, ""))) {
        refuse(
          `${w.text} holds secrets, and a session never reads it. Check the manifest or ask the developer.`,
        );
      }
    }
    if (
      ["pnpm", "npm", "yarn", "bun"].includes(r.name) &&
      r.args.some((a) => /^tf(:dev)?$/.test(a.text))
    ) {
      refuse("pnpm tf runs tofu init and tofu plan, which need state and credentials.");
    }
    if (!GUARDED.has(r.name)) continue;

    touched = true;
    if (r.viaXargs)
      refuse(`${r.name} behind xargs takes arguments the guard cannot see. Run it directly.`);
    if (r.name === "aws") checkAws(r.args);
    if (r.name === "databricks") checkDatabricks(r.args);
    if (r.name === "tofu" || r.name === "terraform") checkTofu(r.name, r.args);
    if (r.name === "kubectl") checkKubectl(r.args);

    const local = r.name === "tofu" || r.name === "terraform";
    if (!local && readsProduction(r, context) && !context.prodWindowOpen()) {
      refuse(
        "this reads production. Ask the developer to run pnpm analyst:prod-window in their own terminal, and to confirm in the conversation.",
      );
    }
  }

  return touched;
}

function projectRoot() {
  if (process.env.CLAUDE_PROJECT_DIR) return process.env.CLAUDE_PROJECT_DIR;
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
  } catch {
    return process.cwd();
  }
}

function windowOpen(marker) {
  try {
    const age = (Date.now() - statSync(marker).mtimeMs) / 1000;
    return Math.max(age, 0) < PROD_WINDOW_SECONDS;
  } catch {
    return false;
  }
}

function block(reason) {
  process.stderr.write(`BLOCKED: ${reason}\n`);
  process.stderr.write(
    "A session may read cloud state but never change it. See docs/agents/cloud-access.md.\n",
  );
  process.exit(2);
}

async function main() {
  let input = "";
  for await (const chunk of process.stdin) input += chunk;

  let payload;
  try {
    payload = JSON.parse(input);
  } catch {
    block("the cloud guard could not read the tool call.");
  }
  const command = payload?.tool_input?.command;
  if (typeof command !== "string" || command.trim() === "") process.exit(0);

  const root = projectRoot();
  const context = {
    prodWindowOpen: () => windowOpen(join(root, ".claude", "analyst-prod.ok")),
    exportedProfile: {},
    environmentProfile: {
      aws: process.env.AWS_PROFILE,
      databricks: process.env.DATABRICKS_CONFIG_PROFILE,
    },
    inProductionRoot: false,
  };

  let touched;
  try {
    touched = judge(command, context);
  } catch (error) {
    if (error instanceof Refusal) block(error.message);
    block(
      `the cloud guard failed (${error?.message ?? error}), so it refuses rather than guessing.`,
    );
  }

  if (touched) {
    const line = `${new Date().toISOString()}\t${payload.session_id ?? "unknown"}\t${command.replace(/\n/g, "\\n")}\n`;
    try {
      appendFileSync(join(root, ".claude", "cloud-commands.log"), line);
    } catch {
      // The log is a convenience. A missing .claude directory must not block a read.
    }
  }
  process.exit(0);
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  await main();
}
