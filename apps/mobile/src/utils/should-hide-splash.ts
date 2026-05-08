export function shouldHideSplash(
  fontsLoaded: boolean,
  migrationsReady: boolean,
  migrationsError: Error | undefined,
): boolean {
  if (migrationsError) return true;
  return fontsLoaded && migrationsReady;
}
