export function keepTruthy<T>(array: (T | null | undefined | false | '' | 0)[]): T[] {
  return array.filter(Boolean) as T[]
}
