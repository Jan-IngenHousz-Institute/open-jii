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
│   │   ├── failed-uploads-storage.ts
│   │   └── successful-uploads-storage.ts
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
