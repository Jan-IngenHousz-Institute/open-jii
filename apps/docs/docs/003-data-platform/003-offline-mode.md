# Offline Mode

The openJII mobile app is designed to work in environments with poor or no internet connectivity. This page describes how offline mode works and what to expect.

## How it works

### Session persistence

When you log in, your session is cached securely on the device using SecureStore. If you lose internet connectivity or restart the app without a connection, you stay logged in and can continue using the app. The session is validated with the server when connectivity is restored.

- **Network drop while using the app**: You remain logged in. The app detects the network loss and stops trying to validate your session until the connection returns.
- **Cold start without internet**: If you were previously logged in, the app loads your cached session and takes you directly to the main screen.
- **Sign-out**: Works both online and offline. The local session is cleared immediately. The server session expires on its own if the sign-out request cannot reach the server.

### Data prefetching

After logging in, the app automatically prefetches all data needed for offline measurements:

- **Experiments**: All experiments you are a member of
- **Measurement flows**: The flow graph for each experiment
- **Protocols**: All measurement protocols referenced in your flows
- **Macros**: All analysis macros referenced in your flows

This data is cached indefinitely and served from cache when offline. When you are back online, the data is refreshed in the background.

### Taking measurements offline

Once data is prefetched, you can run complete measurement flows without internet:

1. Select an experiment (loaded from cache)
2. Start the measurement flow (loaded from cache)
3. Connect to your sensor via Bluetooth (no internet needed)
4. Take measurements and answer questions
5. Measurement results are saved locally

When internet is restored, measurements sync automatically to the server.

### Login screen offline behavior

If you are on the login screen without internet:

- A yellow banner appears: *"You are offline. Please connect to the internet to log in."*
- All login buttons (email, GitHub, ORCID) are disabled
- OTP input and resend are disabled
- Once connectivity returns, the banner disappears and login is re-enabled

## Limitations

- **First login requires internet**: You must be online to authenticate for the first time. After that, the session persists offline.
- **New experiments require internet**: If a new experiment is added to your account, you need to be online for the prefetch to pick it up.
- **Measurement upload is queued**: Results are stored locally and uploaded when connectivity returns. Check the "Recent" tab to see pending uploads.
