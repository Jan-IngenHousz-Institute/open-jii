# Mobile app

After registering, download the openJII app from [Play Store](https://play.google.com/store/apps/details?id=com.openjii.app) (Android only).
At the moment the mobile app is mostly targeted at the MultispeQ sensor, but more sensors will be added soon.

### Key features
- Log in via **ORCID, GitHub or email** (6-digit OTP code)
- Connect to **MultispeQ** via Bluetooth
- Inspect MultispeQ battery status
- **Take measurements** via MultispeQ
- Streamlined measurement flow with animated progress bar
  - Do measurements with or without internet connectivity (online/offline)
  - Auto-advance on yes/no and multi-choice answers
  - Auto-remember answers and auto-skip instructions on repeat iterations
  - Preview raw data and processed data in tabbed view
  - Upload measurement to web platform
- **Question-only flows** — collect survey data or field observations without a sensor
- **Add comments** to measurements via bottom-sheet modal
- **Swipe actions** on measurements — swipe to upload, comment, or delete
- **Export measurements** locally as JSON for backup or external analysis
- **Python macro processing** — run Python macros on-device via embedded Pyodide runtime
- **View measurement data** of experiments
- **Turn off** sensor device

### Measurement flow

The measurement flow guides you through an experiment's configured steps (instructions, questions, measurements, analysis). Key behaviors:

- **Experiment selection** is integrated into the flow — select your experiment and start immediately.
- **Progress bar** shows your position in the flow with an animated gradient indicator.
- **Auto-advance** — yes/no and multi-choice questions advance automatically after selection (unless optional).
- **Smart skipping** — on repeat iterations, instruction steps and remembered answers are skipped automatically.
- **Overview screen** — before submitting, review all your answers. Tap any answer to navigate back and edit it.
- **Results** — after measurement, view raw data and processed results in a tabbed view.

### Comments and annotations

You can add comments to unsynced measurements:
- Swipe left on a measurement to reveal the comment button.
- A bottom-sheet modal opens showing measurement context (answers, experiment, timestamp).
- Enter your comment and save — it will be included when the measurement is uploaded.

### Exporting measurements

Measurements can be exported locally for backup or troubleshooting:
- In the **Recent** tab, tap the export button to save all measurements as a JSON file.
- Individual measurements can also be exported as rescue files.
- Exported files include sync status, timestamps, experiment names, and full measurement data.
- Files are shared via the system's native share dialog.

### Data compression

Measurements are automatically compressed (gzip) before being stored on-device, significantly reducing storage usage. Legacy uncompressed entries are handled transparently — no manual migration needed.

MQTT payloads are also compressed (gzip + base64) before transmission, reducing data usage on mobile networks.

### Crash reporting and diagnostics

The app includes automatic crash reporting via PostHog:
- Uncaught exceptions, unhandled promise rejections, and console errors are tracked.
- App lifecycle events (install, update, open, background) are captured.
- Data is sent to a EU-hosted endpoint for privacy compliance.

### Logging in on a phone without emailbox

Be sure to have an [openJII account](../introduction/quick-start-guide).
Log in via ORCID, GitHub or if you want to use a phone that does **not** have access to your emailbox, you need this procedure to log in.

Use the following steps to **log in via email**:
- Download the openJII app on the phone (lets call it the 'sensorphone') that you want to connect to your sensor
- Open the app and enter your email address at the login screen
- Now go to a device that has your emailbox, like a desktop, laptop, tablet or (personal) mobile phone. Open the email and scroll to the 6-digit code
- Use the sensorphone and enter the 6-digit code
- You will be logged in to the app

### Minimal specs
- Android 7.0 Nougat (API level 24) or newer
- minimum 2 GB of RAM
