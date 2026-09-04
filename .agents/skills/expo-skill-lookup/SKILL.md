---
name: expo-skill-lookup
description: Fetch the right upstream Expo/EAS skill on demand instead of guessing Expo APIs. Use before any Expo, EAS, or React Native task — builds, OTA updates, Observe, Insights, router, native modules, animations, app-store submission.
---

# Expo skill lookup

Read `AGENTS.md` first.

Expo maintains task guides identical in spirit to the `openjii-*` skills in this repo. They are
**not vendored here** — fetch the one that matches the task, then follow it.

- Print a skill without installing anything:
  `pnpm dlx skills use expo/skills@<name>`
- List everything available: `pnpm dlx skills find expo/skills`, or browse
  <https://github.com/expo/skills/tree/main/plugins/expo/skills>
- Raw file (no CLI): `https://raw.githubusercontent.com/expo/skills/main/plugins/expo/skills/<name>/SKILL.md`

## Router

| Skill                    | Fetch it when                                                                 |
| ------------------------ | ----------------------------------------------------------------------------- |
| `expo-overview`          | Entry point for any Expo/EAS task; routes to the others                       |
| `expo-upgrade`           | Upgrading the Expo SDK or fixing dependency drift                             |
| `eas-app-stores`         | EAS Build/Submit to Play Store (or App Store), versions and build numbers     |
| `eas-update-insights`    | Health of a published EAS Update: crashes, installs, payload size             |
| `eas-observe`            | `expo-observe` setup, querying startup/navigation metrics via `eas observe:*` |
| `eas-workflows`          | Writing or debugging `.eas/workflows/` CI YAML                                |
| `eas-hosting`            | Deploying web exports or API routes to EAS Hosting                            |
| `eas-simulator`          | Running the app on a remote EAS-hosted simulator                              |
| `expo-router`            | Navigation: routes, Stack, tabs, modals, deep links                           |
| `expo-module`            | Writing an Expo native module or view (Swift/Kotlin)                          |
| `expo-migrate-module`    | Migrating a native module to the Expo Modules 2.0 macro API                   |
| `expo-native-ui`         | Native-feeling screens: HIG styling, SF Symbols, native controls              |
| `expo-ui`                | `@expo/ui` SwiftUI/Compose components (sheets, pickers, sliders)              |
| `expo-animation`         | Animations and gestures: springs, threads, handoffs                           |
| `expo-design-system`     | Design tokens and component conventions in an Expo app                        |
| `expo-tailwind-setup`    | Tailwind/NativeWind setup in Expo                                             |
| `expo-data-fetching`     | fetch, React Query, offline caching in Expo                                   |
| `expo-dev-client`        | Development builds and internal distribution                                  |
| `expo-dom`               | DOM components: running web code inside a native app                          |
| `expo-web-to-native`     | Porting a web React app to native incrementally                               |
| `expo-brownfield`        | Embedding Expo in an existing native app                                      |
| `expo-app-clip`          | iOS App Clips                                                                 |
| `expo-project-structure` | Scaffolding a new Expo app (never restructure this one)                       |
| `expo-examples`          | Official `with-*` example projects for third-party integrations               |
| `expo-skill-feedback`    | Reporting feedback on a skill or Expo itself                                  |

Docs lookup without a skill: append `.md` to any <https://docs.expo.dev> URL for the
agent-friendly Markdown version; <https://docs.expo.dev/llms.txt> has the full map.
