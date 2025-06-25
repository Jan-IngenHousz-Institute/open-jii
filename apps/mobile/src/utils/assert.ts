type EnvVars<T extends Record<string, string | undefined>> = {
  [K in keyof T]: string;
};

export function assertEnvVariables<T extends Record<string, string | undefined>>(
  vars: T,
): EnvVars<T> {
  const missingKeys: string[] = [];

  for (const key in vars) {
    if (!vars[key]) {
      missingKeys.push(key);
    }
  }

  if (missingKeys.length > 0) {
    throw new Error(`Missing environment variables: ${missingKeys.join(", ")}`);
  }

  return vars as EnvVars<T>;
}
