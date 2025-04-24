# 📸 PhotosynQ

PhotosynQ is a mobile application developed using [Expo](https://expo.dev/), enabling fast development and deployment for both Android and iOS platforms. This guide will help you get started with running and building the app locally.

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
npm install
```

---

## 📱 Running the App

### ▶️ Start the development server

This will start the Metro bundler and open the project in Expo Dev Tools:

```bash
npm start
```

### 🤖 Run on Android

To run the app on an Android device or emulator:

```bash
npm run android
```

Make sure you have an Android device connected or an emulator running.

### 🍏 Run on iOS

To run the app on an iOS simulator (macOS only):

```bash
npm run ios
```

Ensure Xcode and its Command Line Tools are properly installed.

---

## 🛠️ Build for Android (Local)

To build an Android APK locally using [EAS Build](https://docs.expo.dev/build/introduction/):

```bash
npm run build-android
```

This uses the `preview` profile in your `eas.json` and creates a local build.

---

## 📂 Project Structure

```
photosynq/
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
