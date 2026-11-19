import { readFileSync } from "fs";
import { resolve } from "path";

/** The serving store module's infrastructure, which says what each store user may do. */
const SERVING_STORE_MODULE = resolve(__dirname, "../../../../infrastructure/modules/serving-store");

function moduleFile(path: string): string {
  return readFileSync(resolve(SERVING_STORE_MODULE, path), "utf-8");
}

/** A list of names from the serving store module's locals. */
export function localList(name: string): string[] {
  const listing =
    new RegExp(`\\n {2}${name} = \\[([^\\]]*)\\]`).exec(moduleFile("main.tf"))?.[1] ?? "";
  return [...listing.matchAll(/"(\w+)"/g)].map(([, item]) => item);
}

/** A store user's profile and grants as the serving store module writes them into users.xml. */
export function storeUser(role: string): { profile: string; grants: string[] } {
  const block =
    new RegExp(`\\n {4}${role} = \\{([\\s\\S]*?)\\n {4}\\}`).exec(moduleFile("main.tf"))?.[1] ?? "";
  const profile = /profile\s*=\s*"(\w+)"/.exec(block)?.[1] ?? "";
  const grants = [
    ...block.matchAll(/\[for (\w+) in (local\.\w+|concat\([^)]*\)) : "([^"]+)"\]|"(GRANT [^"]+)"/g),
  ].flatMap((match) => {
    const plain = match.at(4);
    if (plain !== undefined) {
      return [plain];
    }
    const [, name, listings, template] = match;
    return [...listings.matchAll(/local\.(\w+)|"(\w+)"/g)].flatMap((item) => {
      const listing = item.at(1);
      const values = listing === undefined ? [item[2]] : localList(listing);
      return values.map((value) => template.replace(`\${${name}}`, value));
    });
  });
  return { profile, grants };
}

/** A profile's settings as users.xml sets them, its parent's first, and the ones it fixes. */
function profileSettings(name: string): { settings: Map<string, string>; fixed: string[] } {
  const profiles = moduleFile("templates/users.xml.tftpl").replace(/<!--[\s\S]*?-->/g, "");
  const body =
    new RegExp(`<profiles>[\\s\\S]*?<${name}>([\\s\\S]*?)</${name}>`).exec(profiles)?.[1] ?? "";
  const constraints = /<constraints>([\s\S]*?)<\/constraints>/.exec(body)?.[1] ?? "";
  const parent = /<profile>(\w+)<\/profile>/.exec(body)?.[1];

  const settings = new Map(parent === undefined ? [] : profileSettings(parent).settings);
  const own = body.replace(/<constraints>[\s\S]*?<\/constraints>/, "");
  for (const [, setting, value] of own.matchAll(/<(\w+)>([^<]*)<\/\1>/g)) {
    if (setting !== "profile") {
      settings.set(setting, value);
    }
  }

  const fixed = [...constraints.matchAll(/<(\w+)><const\/><\/\1>/g)].map(([, setting]) => setting);
  return { settings, fixed };
}

/** The profile as a settings profile the store can be given over SQL, every constraint kept. */
export function settingsProfileClause(name: string): string {
  const { settings, fixed } = profileSettings(name);
  const valued = [...settings].map(
    ([setting, value]) => `${setting} = ${value}${fixed.includes(setting) ? " CONST" : ""}`,
  );
  const unvalued = fixed
    .filter((setting) => !settings.has(setting))
    .map((setting) => `${setting} CONST`);
  return [...valued, ...unvalued].join(", ");
}
