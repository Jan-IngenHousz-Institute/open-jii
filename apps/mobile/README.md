# 📸 PhotosynQ

openJII is a mobile application developed using [Expo](https://expo.dev/), enabling fast development and deployment for both Android and iOS platforms. This guide will help you get started with running and building the app locally.

---

## 🚀 Getting Started

Make sure you have the following installed:

- [Node.js](https://nodejs.org/) (Recommended: v18+)
- [Expo CLI](https://docs.expo.dev/get-started/installation/)
- [EAS CLI](https://docs.expo.dev/eas-update/intro/) (`npm install -g eas-cli`)
- Xcode (for iOS development)
- Android Studio (for Android development)

To install dependencies:

```bash
pnpm install
```

---

## 📱 Running the App

### ▶️ Start the development server

This will start the Metro bundler and open the project in Expo Dev Tools:

```bash
pnpm start
```

### 🤖 Run on Android

To run the app on an Android device or emulator:

```bash
pnpm run android
```

Make sure you have an Android device connected or an emulator running.

### 🍏 Run on iOS

To run the app on an iOS simulator (macOS only):

```bash
pnpm run ios
```

Ensure Xcode and its Command Line Tools are properly installed.

---

## 🛠️ Build for Android (Local)

To build an Android APK locally using [EAS Build](https://docs.expo.dev/build/introduction/):

```bash
pnpm run build-android
```

This uses the `preview` profile in your `eas.json` and creates a local build.

---

## 🚢 Release Flow (OTA + Play Tracks)

The mobile app ships through four progressively-wider stages. Each stage has a **Play track** (where the AAB lives) and a matching **EAS Update channel** (where JS-only OTA patches are published).

| Stage | Audience | Play track | OTA channel | Trigger |
|---|---|---|---|---|
| **preview** | devs | _(APK only)_ | `preview` | every push to `main` affecting mobile |
| **internal** | internal QA + selected testers | `internal` | `internal` | semantic-release tag `mobile-vX.Y.Z` |
| **beta** | extended testers (closed/open testing) | `beta` | `beta` | manual promotion |
| **production** | general public | `production` | `production` | manual promotion + Play staged rollout |

### How OTA vs. AAB is decided

Runtime version uses Expo's `fingerprint` policy. Each release workflow:

1. Computes the current native fingerprint
2. Compares it to the last build's fingerprint on that track
3. **Same fingerprint** → JS-only change → publishes OTA, skips AAB build
4. **Different fingerprint** → native delta → builds AAB + submits + then OTAs

This means: pure JS/asset changes ship in minutes via OTA; native dep / plugin / `app.json` changes always go through a store rebuild.

### Stage 1 — Preview (automatic)

Triggered on every push to `main` when `mobile` is in the affected packages list (Turborepo).

- Workflow: `.github/workflows/mobile-preview-ota.yml`
- Publishes: `eas update --branch preview`
- **Drift gate:** if the native fingerprint changed since the last `preview` AAB, the workflow **skips the OTA** and posts a warning that a new APK must be distributed manually:

  ```bash
  eas build --profile preview --platform android
  ```

  > **Note:** the drift gate compares against the fingerprint of the last **cloud** build fetched via `eas build:list`. Local APKs produced by `pnpm run build-apk` are not recorded in EAS and will **not** update this baseline — always use the `eas build` command above to clear a drift warning in CI.

- Manual override available via `workflow_dispatch` with `force=true`.

Local equivalent:

```bash
pnpm run update:preview
```

### Stage 2 — Internal (automatic on release)

Triggered when `release.yml` creates a `mobile-vX.Y.Z` tag (semantic-release picks up `feat:` / `fix:` commits affecting mobile).

- Workflow: `.github/workflows/mobile-release.yml`
- Sets `app.json` version, generates Play release notes from the GitHub release body.
- Compares current fingerprint against the last internal build:
  - **`mode=build`** (fingerprint changed or no prior build): builds AAB and submits to Play `internal` track. Local equivalent: `pnpm run submit-to-google-play`
  - **`mode=ota`** (fingerprint unchanged): publishes OTA update to the `internal` channel only. Local equivalent: `pnpm run update:internal`

### Stage 3 — Beta (manual)

Run after the internal build has soaked (suggested 24–48h, no critical bug reports).

```bash
gh workflow run mobile-promote.yml \
  --field track=beta \
  --field version=1.2.0      # optional, defaults to latest mobile-v* tag
```

- Workflow: `.github/workflows/mobile-promote.yml`
- Builds AAB to Play `beta` track (gated on fingerprint) and publishes OTA to the `beta` channel.

Local equivalent:

```bash
pnpm run update:beta
```

### Stage 4 — Production (manual)

Run after beta has soaked.

```bash
gh workflow run mobile-promote.yml \
  --field track=production \
  --field version=1.2.0
```

- Workflow: same `mobile-promote.yml`
- Builds AAB to Play `production` track (gated) and publishes OTA to the `production` channel.
- **Manual step in Play Console:** configure staged rollout (start 10–20%, ramp over 24–48h).

Local equivalent:

```bash
pnpm run update:production
```

### Rollback

OTA is reversible at any stage. Choose based on what you're rolling back to:

**Republish a previously published update** (most common — re-points the channel to an earlier update):

```bash
eas update:republish --branch <preview|internal|beta|production>
```

**Roll back to the embedded update** (the JS bundle shipped inside the last native build):

```bash
eas update:roll-back-to-embedded --branch <preview|internal|beta|production> --runtime-version <version>
```

Clients fetch the rolled-back update on next launch. Native AABs roll back via Play Console (halt rollout / promote previous version).

### Summary cheat-sheet

```text
push main         →  preview OTA              (Stage 1, auto)
mobile-vX.Y.Z tag →  internal AAB + OTA       (Stage 2, auto via release.yml)
gh workflow run mobile-promote.yml track=beta        →  beta AAB + OTA       (Stage 3)
gh workflow run mobile-promote.yml track=production  →  production AAB + OTA (Stage 4)
```

---

## 🗄️ Local Database (Drizzle + Expo SQLite)

The app uses [Drizzle ORM](https://orm.drizzle.team/) with [Expo SQLite](https://docs.expo.dev/versions/latest/sdk/sqlite/) for on-device storage (measurement uploads). The schema is defined in `src/services/db/schema.ts` and migrations are managed by Drizzle Kit.

### How it works

- **Schema** — `src/services/db/schema.ts` defines the `measurements` table.
- **Client** — `src/services/db/client.ts` opens the SQLite database and exports the Drizzle instance.
- **Migrations** — generated SQL files in `drizzle/` are bundled into the app via `babel-plugin-inline-import`. On startup, `useMigrations()` in `_layout.tsx` runs any pending migrations before the app renders.
- **Legacy migration** — on first access, any entries in AsyncStorage (from the previous storage implementation) are transparently migrated into SQLite and then deleted.

### Modifying the schema

1. Edit the schema in `src/services/db/schema.ts`.
2. Generate a new migration:
   ```bash
   npx drizzle-kit generate
   ```
3. Update `drizzle/migrations.ts` to import the new `.sql` file (drizzle-kit regenerates this, but verify it).
4. Rebuild and test — `useMigrations()` will automatically apply the new migration on next app launch.

### Bundler configuration

The following config changes enable SQL migration bundling:

- **`babel.config.js`** — `babel-plugin-inline-import` with `[".sql"]` extensions
- **`metro.config.js`** — `.sql` added to `sourceExts`
- **`drizzle.config.ts`** — `dialect: "sqlite"`, `driver: "expo"`
- **`declarations.d.ts`** — `declare module "*.sql"` for TypeScript

---

## 📂 Project Structure

```
mobile/
├── index.ts
├── package.json
├── drizzle/              # Generated SQL migrations
│   ├── migrations.ts     # Migration index (bundled into app)
│   └── *.sql             # Individual migration files
├── drizzle.config.ts     # Drizzle Kit config
├── src/
│   ├── app/              # Expo Router screens & layouts
│   ├── services/
│   │   ├── db/           # Database client & schema
│   │   └── measurements-storage.ts
│   ├── components/
│   └── ...
└── ...
```

---

## 📘 Learn More

- [Expo Documentation](https://docs.expo.dev/)
- [React Native Docs](https://reactnative.dev/)
- [EAS Build Guide](https://docs.expo.dev/build/introduction/)

---

Happy Coding! 💚
