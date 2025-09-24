export function processMeasurement(result: object, analyze: (raw: object) => object) {
  if (!("sample" in result)) {
    return result;
  }

  const { sample } = result;

  if (!sample) {
    return result;
  }

  const samples = Array.isArray(sample) ? sample : [sample];
  const timestamp = new Date().toISOString();

  let output: object[] | undefined = undefined;
  try {
    if (analyze) {
      output = samples.map(analyze);
    }
  } catch {
    // ignored
  }

  return { ...result, timestamp, output };
}
