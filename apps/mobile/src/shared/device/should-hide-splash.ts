export function shouldHideSplash(
  fontsLoaded: boolean,
  migrationsReady: boolean,
  i18nReady: boolean,
  forceUpdateReady: boolean,
  migrationsError: Error | undefined,
): boolean {
  if (migrationsError) return true;
  return fontsLoaded && migrationsReady && i18nReady && forceUpdateReady;
}
