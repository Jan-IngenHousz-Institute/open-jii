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

Make sure you have an Android device connected or an emulator running.

```bash
pnpm run android
```

#### Known issues

```
› Opening on Android...
CommandError: No development build (com.openjii.app) for this project is installed. Install a development build on the target device and try again.
```

To install the first development built on the phone you can run `pnpm run android`, once a development build is present you can run `pnpm start` as well and press `a` to run the dev-app on your connected android device.

---


#### ⁉️ Debug on android

To debug an interal test version of the application you can attach the phone  and run:

```bash
npx react-native log-android
```

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

## 📂 Project Structure

```
mobile/
├── index.ts
├── package.json
├── app/
├── assets/
├── components/
└── ...
```

---

## 📘 Learn More

- [Expo Documentation](https://docs.expo.dev/)
- [React Native Docs](https://reactnative.dev/)
- [EAS Build Guide](https://docs.expo.dev/build/introduction/)

---

Happy Coding! 💚
