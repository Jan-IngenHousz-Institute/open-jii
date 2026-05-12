# Mobile styling

The mobile app uses **NativeWind v4** (`className` + Tailwind tokens) as the
single styling system. The shared token set lives in `tailwind.config.js`
(extending `@repo/tailwind-config/native`) with CSS variables defined in
`global.css` and switched by NativeWind's `colorScheme`.

## Rules

- **Never** call `StyleSheet.create`. Use `className` and inline numeric
  `style` only for values Tailwind can't express (e.g. animated values).
- **Never** branch on `theme.isDark` in JSX. Use Tailwind's `dark:` variant
  against semantic tokens (`bg-card`, `text-foreground`, `border-border`,
  `bg-surface`, …).
- The theme is driven by `ThemeProvider` in `src/context/ThemeContext.tsx`,
  which calls `colorScheme.set()` from `nativewind` whenever the user
  preference changes — keeping `dark:` variants in sync with the in-app
  toggle, not just the OS preference.

## Token map

Semantic tokens (CSS vars in `global.css`, mapped in `tailwind.config.js`):

| Token              | Light                | Dark                 |
| ------------------ | -------------------- | -------------------- |
| `background`       | `#FFFFFF`            | `#121212`            |
| `foreground`       | `#121212`            | `#FFFFFF`            |
| `surface`          | `#F5F5F5`            | `#1E1E1E`            |
| `card`             | `#FFFFFF`            | `#252525`            |
| `border` / `input` | `#E0E0E0`            | `#2C2C2C`            |
| `muted-foreground` | gray500              | gray300-ish          |
| `primary`          | `#005e5e`            | `#49e06d`            |
| `gray-background`  | `#F6F8FA`            | `#1C2128`            |
| `success`          | `#10B981`            | same                 |
| `warning`          | `#FBBF24`            | same                 |
| `error` / `destructive` | `#EF4444`       | same                 |
| `info`             | `#3B82F6`            | same                 |

If a new visual needs a token that isn't here, extend `tailwind.config.js`
and `global.css` instead of branching on `theme.isDark` at runtime.

## Approved exceptions — `useTheme()` and JS color reads

There is exactly one place where Tailwind utilities cannot reach: React
Navigation's native header / tab bar, configured via `screenOptions`
(`headerStyle`, `headerTintColor`, `tabBarStyle`, `contentStyle`). These
options take RN style objects, and React Navigation renders the native
header *outside* the NativeWind view tree, so:

- A `dark:` variant on the screen body never affects the header.
- `vars()` from `nativewind` on a wrapper `<View>` does not propagate into
  the native header.
- `cssInterop` / `remapProps` on `Stack.Screen` are awkward because
  `Stack.Screen` is a config component, not a real renderable.

We picked **Option A** from the OJD-1494 investigation: a tiny
`useThemeColors()` hook (`src/hooks/use-theme-colors.ts`) that reads
NativeWind's reactive `useColorScheme()` and returns the JS color set for
the active scheme, sourced from the same `constants/colors.ts` that backs
the CSS vars. Use it like:

```tsx
const c = useThemeColors();
<Stack screenOptions={{
  headerStyle: { backgroundColor: c.background },
  headerTintColor: c.onSurface,
  contentStyle: { backgroundColor: c.surface },
}} />
```

This keeps a *single* source of truth (`constants/colors.ts`) for both
Tailwind tokens and the navigation header, while eliminating every
`theme.isDark ? colors.dark.x : colors.light.x` ternary.

Other approved cases for `useThemeColors()` / `useColorScheme()`:

- Icon `color` props on `lucide-react-native` icons that aren't wrapped in
  a NativeWind component (rare — most icons accept a `className`).
- Third-party native components whose props expect raw color strings.

`useTheme()` from `~/hooks/use-theme` is **deprecated** for new code and
should only persist where the legacy `theme.classes.*` strings are still
in use.

## CI guard

`StyleSheet.create` and `theme.isDark` are blocked in CI — see
`.github/workflows/pr.yml` (`mobile-styling-guard`). Adding either back
fails the build.
